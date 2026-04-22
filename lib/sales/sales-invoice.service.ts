/**
 * Sales Invoice Service - Production-Grade
 * Transaction-safe, multi-tenant isolated, event-driven
 */

import { prisma } from '../db';
import { Prisma } from '@prisma/client';
import { atomicDecrementStock } from '../inventory-transactions';
import { 
  emitSalesInvoiceCreatedEvent, 
  emitSalesInvoicePostedEvent,
  emitStockUpdatedEvent,
  emitJournalEntryCreatedEvent,
  emitJournalEntryPostedEvent,
} from '../events/erp-event-handlers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SalesInvoiceItemInput {
  productId: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CreateSalesInvoiceInput {
  customerId: string;
  date: Date;
  items: SalesInvoiceItemInput[];
  discount?: number;
  tax?: number;
  notes?: string;
  tenantId: string;
  userId?: string;
  salesOrderId?: string;
  correlationId?: string;
}

export interface PostSalesInvoiceInput {
  invoiceId: string;
  tenantId: string;
  userId?: string;
  correlationId?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateTenantId(tenantId: string): void {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('tenantId is required and must be a non-empty string');
  }
}

function validateInvoiceItem(item: SalesInvoiceItemInput): void {
  if (!item.productId || typeof item.productId !== 'string' || item.productId.trim() === '') {
    throw new Error('productId is required');
  }

  if (typeof item.quantity !== 'number' || item.quantity <= 0) {
    throw new Error('quantity must be a positive number');
  }

  if (typeof item.price !== 'number' || item.price < 0) {
    throw new Error('price must be a non-negative number');
  }

  if (typeof item.total !== 'number' || item.total < 0) {
    throw new Error('total must be a non-negative number');
  }
}

// ============================================================================
// SALES INVOICE SERVICE
// ============================================================================

/**
 * Create a sales invoice with full transaction safety
 * - Validates stock availability
 * - Creates invoice and items
 * - Decrements stock atomically
 * - Emits events to outbox
 * - All in a single Prisma transaction
 */
export async function createSalesInvoice(
  input: CreateSalesInvoiceInput
): Promise<any> {
  validateTenantId(input.tenantId);

  if (!input.customerId || typeof input.customerId !== 'string') {
    throw new Error('customerId is required');
  }

  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('items must be a non-empty array');
  }

  for (const item of input.items) {
    validateInvoiceItem(item);
  }

  return await prisma.$transaction(async (tx) => {
    // Validate customer belongs to tenant
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { tenantId: true, creditLimit: true },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    if (customer.tenantId !== input.tenantId) {
      throw new Error('Customer belongs to different tenant');
    }

    // Validate products and calculate totals
    let subtotal = 0;
    const validatedItems: any[] = [];

    for (const item of input.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { 
          tenantId: true, 
          stock: true, 
          price: true,
          code: true,
          nameAr: true,
        },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (product.tenantId !== input.tenantId) {
        throw new Error(`Product belongs to different tenant`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `Insufficient stock for product ${product.nameAr || product.code}. Available: ${product.stock}, Required: ${item.quantity}`
        );
      }

      validatedItems.push({
        ...item,
        product,
      });

      subtotal += item.total;
    }

    const discount = input.discount || 0;
    const tax = input.tax || 0;
    const grandTotal = subtotal - discount + tax;

    // Generate invoice number (sequential per tenant)
    const lastInvoice = await tx.salesInvoice.findFirst({
      where: { tenantId: input.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    const lastNumber = lastInvoice?.invoiceNumber 
      ? parseInt(lastInvoice.invoiceNumber.replace(/\D/g, '')) 
      : 0;
    const invoiceNumber = `INV-${String(lastNumber + 1).padStart(6, '0')}`;

    // Create sales invoice
    const invoice = await tx.salesInvoice.create({
      data: {
        invoiceNumber,
        customerId: input.customerId,
        date: input.date,
        status: 'pending',
        paymentStatus: 'pending',
        total: subtotal,
        discount,
        tax,
        grandTotal,
        notes: input.notes,
        salesOrderId: input.salesOrderId,
        tenantId: input.tenantId,
      },
    });

    // Create invoice items
    for (const item of validatedItems) {
      await tx.salesInvoiceItem.create({
        data: {
          salesInvoiceId: invoice.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        },
      });
    }

    // Atomically decrement stock
    await atomicDecrementStock(
      tx,
      input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      invoice.id,
      'sale',
      input.tenantId
    );

    // Emit SalesInvoiceCreated event to outbox
    await emitSalesInvoiceCreatedEvent(
      tx,
      invoice.id,
      invoice.invoiceNumber,
      input.customerId,
      input.items,
      grandTotal,
      input.date,
      input.tenantId,
      input.userId,
      input.correlationId
    );

    // Emit StockUpdated events for each product
    for (const item of validatedItems) {
      const previousStock = item.product.stock;
      const newStock = previousStock - item.quantity;
      
      await emitStockUpdatedEvent(
        tx,
        item.productId,
        item.product.code,
        newStock,
        previousStock,
        'sale',
        invoice.id,
        input.tenantId,
        input.userId,
        input.correlationId
      );
    }

    return invoice;
  });
}

/**
 * Post a sales invoice
 * - Changes status from pending to posted
 * - Creates accounting journal entry
 * - Emits events to outbox
 * - All in a single Prisma transaction
 */
export async function postSalesInvoice(
  input: PostSalesInvoiceInput
): Promise<any> {
  validateTenantId(input.tenantId);

  if (!input.invoiceId || typeof input.invoiceId !== 'string') {
    throw new Error('invoiceId is required');
  }

  return await prisma.$transaction(async (tx) => {
    // Get invoice
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.tenantId !== input.tenantId) {
      throw new Error('Invoice belongs to different tenant');
    }

    if (invoice.status === 'posted') {
      throw new Error('Invoice is already posted');
    }

    // Get fiscal year and open period
    const fiscalYear = await tx.fiscalYear.findFirst({
      where: { 
        tenantId: input.tenantId,
        isClosed: false,
      },
      orderBy: { year: 'desc' },
    });

    if (!fiscalYear) {
      throw new Error('No open fiscal year found');
    }

    const openPeriod = await tx.accountingPeriod.findFirst({
      where: {
        tenantId: input.tenantId,
        fiscalYearId: fiscalYear.id,
        isClosed: false,
      },
    });

    if (!openPeriod) {
      throw new Error('No open accounting period found');
    }

    // Generate journal entry number
    const lastEntry = await tx.journalEntry.findFirst({
      where: { tenantId: input.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { entryNumber: true },
    });

    const lastNumber = lastEntry?.entryNumber 
      ? parseInt(lastEntry.entryNumber.replace(/\D/g, '')) 
      : 0;
    const entryNumber = `JE-${String(lastNumber + 1).padStart(6, '0')}`;

    // Create journal entry lines (double-entry)
    const debitLines: any[] = [];
    const creditLines: any[] = [];

    // Debit: Accounts Receivable
    debitLines.push({
      accountCode: '1200', // Accounts Receivable
      debit: invoice.grandTotal,
      credit: 0,
    });

    // Credit: Sales Revenue
    creditLines.push({
      accountCode: '4000', // Sales Revenue
      debit: 0,
      credit: invoice.total,
    });

    // Credit: Sales Tax (if applicable)
    if (invoice.tax > 0) {
      creditLines.push({
        accountCode: '2200', // Sales Tax Payable
        debit: 0,
        credit: invoice.tax,
      });
    }

    // Debit: Cost of Goods Sold (simplified - should use actual cost)
    const cogsTotal = invoice.items.reduce((sum, item) => sum + (item.total * 0.7), 0); // 70% of sales as COGS
    debitLines.push({
      accountCode: '5000', // Cost of Goods Sold
      debit: cogsTotal,
      credit: 0,
    });

    // Credit: Inventory
    creditLines.push({
      accountCode: '1300', // Inventory
      debit: 0,
      credit: cogsTotal,
    });

    const totalDebit = debitLines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = creditLines.reduce((sum, line) => sum + line.credit, 0);

    // Create journal entry
    const journalEntry = await tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: invoice.date,
        description: `Sales Invoice ${invoice.invoiceNumber}`,
        referenceType: 'SalesInvoice',
        referenceId: invoice.id,
        totalDebit,
        totalCredit,
        isPosted: true,
        postedDate: new Date(),
        createdBy: input.userId,
        tenantId: input.tenantId,
        fiscalYearId: fiscalYear.id,
        accountingPeriodId: openPeriod.id,
        sourceEventId: invoice.id,
        correlationId: input.correlationId,
      },
    });

    // Create journal entry lines
    for (const line of debitLines) {
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountCode: line.accountCode,
          debit: line.debit,
          credit: line.credit,
          tenantId: input.tenantId,
        },
      });
    }

    for (const line of creditLines) {
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountCode: line.accountCode,
          debit: line.debit,
          credit: line.credit,
          tenantId: input.tenantId,
        },
      });
    }

    // Update invoice status
    const updatedInvoice = await tx.salesInvoice.update({
      where: { id: input.invoiceId },
      data: { status: 'posted' },
    });

    // Emit SalesInvoicePosted event
    await emitSalesInvoicePostedEvent(
      tx,
      invoice.id,
      invoice.invoiceNumber,
      input.tenantId,
      input.userId,
      input.correlationId
    );

    // Emit JournalEntryCreated event
    await emitJournalEntryCreatedEvent(
      tx,
      journalEntry.id,
      journalEntry.entryNumber,
      totalDebit,
      totalCredit,
      invoice.date,
      input.tenantId,
      input.userId,
      input.correlationId
    );

    // Emit JournalEntryPosted event
    await emitJournalEntryPostedEvent(
      tx,
      journalEntry.id,
      journalEntry.entryNumber,
      new Date(),
      input.tenantId,
      input.userId,
      input.correlationId
    );

    return updatedInvoice;
  });
}

/**
 * Get sales invoice by ID with tenant isolation
 */
export async function getSalesInvoice(
  invoiceId: string,
  tenantId: string
): Promise<any> {
  validateTenantId(tenantId);

  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: {
        include: {
          product: {
            select: {
              code: true,
              nameAr: true,
            },
          },
        },
      },
      customer: {
        select: {
          code: true,
          nameAr: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.tenantId !== tenantId) {
    throw new Error('Invoice belongs to different tenant');
  }

  return invoice;
}

/**
 * List sales invoices with filtering and pagination
 */
export async function listSalesInvoices(
  tenantId: string,
  options: {
    customerId?: string;
    status?: string;
    paymentStatus?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<any[]> {
  validateTenantId(tenantId);

  const where: Prisma.SalesInvoiceWhereInput = {
    tenantId,
  };

  if (options.customerId) {
    where.customerId = options.customerId;
  }

  if (options.status) {
    where.status = options.status;
  }

  if (options.paymentStatus) {
    where.paymentStatus = options.paymentStatus;
  }

  if (options.startDate || options.endDate) {
    where.date = {};
    if (options.startDate) where.date.gte = options.startDate;
    if (options.endDate) where.date.lte = options.endDate;
  }

  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return await prisma.salesInvoice.findMany({
    where,
    include: {
      customer: {
        select: {
          code: true,
          nameAr: true,
        },
      },
    },
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset,
  });
}
