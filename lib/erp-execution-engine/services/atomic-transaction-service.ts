/**
 * ATOMIC TRANSACTION SERVICE
 * Ensures FULL CONSISTENCY across Invoice, Inventory, and Accounting
 * 
 * CRITICAL: ALL operations succeed or ALL rollback.
 * No partial writes allowed. Ever.
 */

import { prisma } from '@/lib/db';
import { StockError, handleStockError } from '../adapters/inventory-adapter';

/**
 * Transaction Error Types
 */
export class TransactionError extends Error {
  constructor(
    public code: 'INVOICE_FAILED' | 'INVENTORY_FAILED' | 'ACCOUNTING_FAILED' | 'VALIDATION_FAILED',
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

/**
 * Invoice Item Structure
 */
interface InvoiceItem {
  productId: string;
  quantity: number;
  price: number;
  unitCost?: number;
  total?: number;
}

/**
 * Journal Entry Line Structure
 */
interface JournalLine {
  accountCode: string;
  debit: number | { toNumber(): number } | any;
  credit: number | { toNumber(): number } | any;
  description?: string | null;
}

/**
 * ============================================================================
 * ATOMIC SALES INVOICE CREATION
 * ============================================================================
 * 
 * Creates Sales Invoice + Updates Inventory + Creates Journal Entries
 * ALL in ONE database transaction with Serializable isolation.
 * 
 * If ANY step fails → ALL changes rollback automatically
 */
export async function createSalesInvoiceAtomic(params: {
  invoiceData: {
    invoiceNumber: string;
    date: Date;
    customerId: string;
    dueDate?: Date;
    notes?: string;
    status?: string;
  };
  items: InvoiceItem[];
  tenantId: string;
  userId: string;
}) {
  const { invoiceData, items, tenantId, userId } = params;

  // Validate required fields
  if (!items || items.length === 0) {
    throw new TransactionError('VALIDATION_FAILED', 'Invoice must have at least one item');
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const taxRate = 0.15; // 15% VAT
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  return await prisma.$transaction(async (tx) => {
    // ========================================================================
    // STEP 1: Create Sales Invoice
    // ========================================================================
    const invoice = await tx.salesInvoice.create({
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        date: invoiceData.date,
        customerId: invoiceData.customerId,
        notes: invoiceData.notes,
        status: invoiceData.status || 'posted',
        total: subtotal,
        tax: taxAmount,
        grandTotal,
        tenantId,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price,
          })),
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    // ========================================================================
    // STEP 2: ATOMIC Inventory Update (Decrement Stock)
    // ========================================================================
    for (const item of items) {
      // Atomic stock decrement with RETURNING
      const stockResult = await tx.$queryRaw`
        UPDATE "Product"
        SET stock = stock - ${item.quantity}
        WHERE id = ${item.productId}
          AND "tenantId" = ${tenantId}
          AND stock >= ${item.quantity}
        RETURNING id, stock;
      `;

      const rows = stockResult as Array<{ id: string; stock: number }>;
      
      if (rows.length === 0) {
        // Check why it failed (product not found or insufficient stock)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stock: true, nameAr: true },
        });

        if (!product) {
          throw new TransactionError(
            'INVENTORY_FAILED',
            `Product ${item.productId} not found`
          );
        }

        throw new TransactionError(
          'INVENTORY_FAILED',
          `Insufficient stock for product "${product.nameAr}". Available: ${product.stock}, Required: ${item.quantity}`
        );
      }

      // Record inventory transaction for audit
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'sale',
          quantity: -item.quantity,
          referenceId: invoice.id,
          referenceType: 'SalesInvoice',
          unitCost: item.unitCost || 0,
          totalCost: (item.unitCost || 0) * item.quantity,
          tenantId,
          date: new Date(),
        },
      });
    }

    // ========================================================================
    // STEP 3: Create Journal Entry (Accounting)
    // ========================================================================
    // Sales Invoice Accounting Entry:
    // DR: Accounts Receivable (1020)
    // CR: Sales Revenue (4010)
    // CR: Sales Tax Payable (2030)
    
    const journalEntry = await tx.journalEntry.create({
      data: {
        entryNumber: await generateEntryNumber(tx),
        entryDate: invoiceData.date,
        description: `Sales Invoice ${invoiceData.invoiceNumber}`,
        referenceType: 'SalesInvoice',
        referenceId: invoice.id,
        isPosted: true,
        postedDate: new Date(),
        tenantId,
        createdBy: userId,
        lines: {
          create: [
            {
              accountCode: '1020', // Accounts Receivable
              debit: grandTotal,
              credit: 0,
              description: `AR for Invoice ${invoiceData.invoiceNumber}`,
              tenantId,
            },
            {
              accountCode: '4010', // Sales Revenue
              debit: 0,
              credit: subtotal,
              description: `Revenue from Invoice ${invoiceData.invoiceNumber}`,
              tenantId,
            },
            {
              accountCode: '2030', // Sales Tax Payable
              debit: 0,
              credit: taxAmount,
              description: `Tax on Invoice ${invoiceData.invoiceNumber}`,
              tenantId,
            },
          ],
        },
      },
      include: {
        lines: true,
      },
    });

    // Update account balances atomically
    const linesWithDetails = await tx.journalEntryLine.findMany({
      where: { journalEntryId: journalEntry.id },
    });
    await updateAccountBalances(tx, linesWithDetails as unknown as JournalLine[], tenantId);

    // Return complete result
    return {
      invoice,
      journalEntry,
      itemsProcessed: items.length,
    };
  }, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 15000,
  });
}

/**
 * ============================================================================
 * ATOMIC PURCHASE INVOICE CREATION
 * ============================================================================
 * 
 * Creates Purchase Invoice + Updates Inventory + Creates Journal Entries
 * ALL in ONE database transaction.
 */
export async function createPurchaseInvoiceAtomic(params: {
  invoiceData: {
    invoiceNumber: string;
    date: Date;
    supplierId: string;
    dueDate?: Date;
    notes?: string;
    status?: string;
  };
  items: InvoiceItem[];
  tenantId: string;
  userId: string;
}) {
  const { invoiceData, items, tenantId, userId } = params;

  if (!items || items.length === 0) {
    throw new TransactionError('VALIDATION_FAILED', 'Invoice must have at least one item');
  }

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * (item.unitCost || item.price)), 0);
  const taxRate = 0.15;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  return await prisma.$transaction(async (tx) => {
    // ========================================================================
    // STEP 1: Create Purchase Invoice
    // ========================================================================
    const invoice = await tx.purchaseInvoice.create({
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        date: invoiceData.date,
        supplierId: invoiceData.supplierId,
        notes: invoiceData.notes,
        status: invoiceData.status || 'posted',
        total: grandTotal,
        tenantId,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.unitCost || item.price,
            total: item.quantity * (item.unitCost || item.price),
          })),
        },
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    // ========================================================================
    // STEP 2: ATOMIC Inventory Update (Increment Stock)
    // ========================================================================
    for (const item of items) {
      // Atomic stock increment with RETURNING
      const stockResult = await tx.$queryRaw`
        UPDATE "Product"
        SET stock = stock + ${item.quantity}
        WHERE id = ${item.productId}
          AND "tenantId" = ${tenantId}
        RETURNING id, stock;
      `;

      const rows = stockResult as Array<{ id: string; stock: number }>;
      
      if (rows.length === 0) {
        throw new TransactionError(
          'INVENTORY_FAILED',
          `Product ${item.productId} not found in tenant ${tenantId}`
        );
      }

      // Update product cost
      await tx.product.update({
        where: { id: item.productId },
        data: { cost: item.unitCost || item.price },
      });

      // Record inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'purchase',
          quantity: item.quantity,
          referenceId: invoice.id,
          referenceType: 'PurchaseInvoice',
          unitCost: item.unitCost || item.price,
          totalCost: item.quantity * (item.unitCost || item.price),
          tenantId,
          date: new Date(),
        },
      });
    }

    // ========================================================================
    // STEP 3: Create Journal Entry (Accounting)
    // ========================================================================
    // Purchase Invoice Accounting Entry:
    // DR: Inventory (1030)
    // DR: Input Tax (2030 reversal)
    // CR: Accounts Payable (2010)
    
    const journalEntry = await tx.journalEntry.create({
      data: {
        entryNumber: await generateEntryNumber(tx),
        entryDate: invoiceData.date,
        description: `Purchase Invoice ${invoiceData.invoiceNumber}`,
        referenceType: 'PurchaseInvoice',
        referenceId: invoice.id,
        isPosted: true,
        postedDate: new Date(),
        tenantId,
        createdBy: userId,
        lines: {
          create: [
            {
              accountCode: '1030', // Inventory
              debit: subtotal,
              credit: 0,
              description: `Inventory from Invoice ${invoiceData.invoiceNumber}`,
              tenantId,
            },
            {
              accountCode: '2030', // Tax (assuming input tax tracking)
              debit: taxAmount,
              credit: 0,
              description: `Input Tax on Invoice ${invoiceData.invoiceNumber}`,
              tenantId,
            },
            {
              accountCode: '2010', // Accounts Payable
              debit: 0,
              credit: grandTotal,
              description: `AP for Invoice ${invoiceData.invoiceNumber}`,
              tenantId,
            },
          ],
        },
      },
      include: {
        lines: true,
      },
    });

    // Update account balances
    const linesWithDetails = await tx.journalEntryLine.findMany({
      where: { journalEntryId: journalEntry.id },
    });
    await updateAccountBalances(tx, linesWithDetails as JournalLine[], tenantId);

    return {
      invoice,
      journalEntry,
      itemsProcessed: items.length,
    };
  }, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 15000,
  });
}

/**
 * ============================================================================
 * HELPER: Generate Journal Entry Number
 * ============================================================================
 */
async function generateEntryNumber(txClient: any): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  
  // Count entries created today within this transaction
  const count = await txClient.journalEntry.count({
    where: {
      entryDate: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
      },
    },
  });

  const sequence = String(count + 1).padStart(4, '0');
  return `JE-${dateStr}-${sequence}`;
}

/**
 * ============================================================================
 * HELPER: Update Account Balances
 * ============================================================================
 * Updates account running balances atomically
 */
async function updateAccountBalances(
  txClient: any,
  lines: JournalLine[],
  tenantId: string
): Promise<void> {
  for (const line of lines) {
    // Get account to determine normal balance
    const account = await txClient.account.findUnique({
      where: { tenantId_code: { tenantId, code: line.accountCode } },
      select: { id: true, type: true, balance: true },
    });

    if (!account) {
      console.warn(`Account ${line.accountCode} not found for balance update`);
      continue;
    }

    // Calculate balance change based on account type
    let balanceChange = 0;
    
    // Assets & Expenses: Debit increases, Credit decreases
    // Liabilities, Equity, Revenue: Credit increases, Debit decreases
    const isDebitNormal = ['Asset', 'Expense'].includes(account.type);
    
    if (isDebitNormal) {
      balanceChange = line.debit - line.credit;
    } else {
      balanceChange = line.credit - line.debit;
    }

    // Atomic balance update
    await txClient.account.update({
      where: { id: account.id },
      data: {
        balance: {
          increment: balanceChange,
        },
      },
    });
  }
}

/**
 * ============================================================================
 * ERROR HANDLER
 * ============================================================================
 */
export function handleTransactionError(error: unknown): {
  status: number;
  body: { error: string; code: string; details?: string };
} {
  if (error instanceof TransactionError) {
    const statusMap: Record<TransactionError['code'], number> = {
      VALIDATION_FAILED: 400,
      INVOICE_FAILED: 500,
      INVENTORY_FAILED: 409, // Conflict - insufficient stock
      ACCOUNTING_FAILED: 500,
    };

    return {
      status: statusMap[error.code],
      body: {
        error: error.message,
        code: error.code,
        details: error.cause?.message,
      },
    };
  }

  if (error instanceof StockError) {
    return handleStockError(error);
  }

  // Unknown error
  return {
    status: 500,
    body: {
      error: 'Transaction failed',
      code: 'TRANSACTION_FAILED',
    },
  };
}
