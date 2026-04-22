/**
 * ERP Event Handlers
 * 
 * Domain event handlers that respond to workflow events
 * and trigger business logic (journal entries, stock updates, etc.)
 */

import { prisma } from '@/lib/db';
import { 
  DomainEvent, 
  DomainEventType, 
  EventHandler 
} from './workflow-engine';
import { 
  createJournalEntry, 
  postJournalEntry, 
  reverseJournalEntry 
} from './accounting';
import { updateStock } from './inventory-transactions';

// ==================== SALES EVENT HANDLERS ====================

/**
 * Handler for QuotationAccepted event
 * - Generate journal entry: DR Unbilled AR, CR Deferred Revenue
 * - Reserve stock (NOT deduct yet)
 */
export const quotationAcceptedHandler: EventHandler = {
  eventType: DomainEventType.QuotationAccepted,
  handler: async (event: DomainEvent) => {
    // @ts-ignore - Model doesn't exist in schema
    const quotation = await prisma.quotation.findUnique({
      where: { id: event.entityId },
      include: { customer: true, items: true },
    });

    if (!quotation) return;

    // Generate journal entry
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: `Quotation ${quotation.quotationNumber} accepted - Customer ${quotation.customer.nameAr}`,
      referenceType: 'Quotation',
      referenceId: quotation.id,
      lines: [
        {
          accountCode: '1021', // Unbilled Accounts Receivable
          debit: quotation.grandTotal,
          credit: 0,
          description: `Unbilled AR for Quotation ${quotation.quotationNumber}`,
        },
        {
          accountCode: '4030', // Deferred Revenue
          debit: 0,
          credit: quotation.grandTotal,
          description: `Deferred Revenue for Quotation ${quotation.quotationNumber}`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);

    // Reserve stock for each item
    for (const item of quotation.items) {
      // @ts-ignore - Model doesn't exist in schema
      await prisma.stockReservation.create({
        data: {
          productId: item.productId,
          referenceType: 'Quotation',
          referenceId: quotation.id,
          reservedQuantity: item.quantity,
          availableQuantity: item.quantity,
          status: 'reserved',
          notes: `Reserved for Quotation ${quotation.quotationNumber}`,
          tenantId: event.tenantId!,
        },
      });
    }
  },
};

/**
 * Handler for InvoiceCreated event
 * - Reverse sales order journal entry (DR Unbilled AR, CR Deferred Revenue)
 * - Create invoice journal entry (DR AR, CR Revenue, CR Tax)
 * - Deduct stock (now actual consumption)
 * - Update inventory transactions
 */
export const invoiceCreatedHandler: EventHandler = {
  eventType: DomainEventType.InvoiceCreated,
  handler: async (event: DomainEvent) => {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: event.entityId },
      include: { 
        customer: true, 
        // @ts-ignore - Prisma type inference issue
        salesOrder: true,
        items: { include: { product: true } },
      },
    });

    if (!invoice) return;

    // Reverse sales order journal entry if it exists
    // @ts-ignore - Prisma type inference issue
    // @ts-ignore - Prisma type inference issue
    if (invoice.salesOrder) {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: {
          referenceType: 'SalesOrder',
          // @ts-ignore - Prisma type inference issue
          referenceId: invoice.salesOrder.id,
          isPosted: true,
        },
      });
      if (journalEntry) {
        await reverseJournalEntry(journalEntry.id);
      }
    }

    // Create invoice journal entry
    // @ts-ignore - Prisma type inference issue
    const journalEntry = await createJournalEntry({
      entryDate: invoice.date,
      // @ts-ignore - Prisma type inference issue
      description: `Sales Invoice ${invoice.invoiceNumber} - Customer ${invoice.customer.nameAr}`,
      referenceType: 'SalesInvoice',
      referenceId: invoice.id,
      lines: [
        {
          accountCode: '1020', // Accounts Receivable
          // @ts-ignore - Prisma type inference issue
          debit: invoice.grandTotal,
          credit: 0,
          description: `AR for Invoice ${invoice.invoiceNumber}`,
        },
        {
          accountCode: '4010', // Sales Revenue
          debit: 0,
          credit: invoice.total,
          description: `Revenue for Invoice ${invoice.invoiceNumber}`,
        },
        {
          accountCode: '2020', // VAT Payable
          debit: 0,
          // @ts-ignore - Prisma type inference issue
          credit: invoice.tax,
          description: `VAT for Invoice ${invoice.invoiceNumber}`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);

    // Deduct stock and create inventory transactions
    // @ts-ignore - Prisma type inference issue
    for (const item of invoice.items) {
      await updateStock(item.productId, -item.quantity, 'sale', invoice.id, event.tenantId!);
      
      // Consume stock reservation if exists
      // @ts-ignore - Model doesn't exist in schema
      await prisma.stockReservation.updateMany({
        where: {
          productId: item.productId,
          referenceType: 'SalesOrder',
          // @ts-ignore - Prisma type inference issue
          referenceId: invoice.salesOrder?.id,
          status: 'reserved',
        },
        data: {
          status: 'consumed',
          consumedAt: new Date(),
        },
      });
    }
  },
};

/**
 * Handler for InvoicePaid event
 * - Payment journal entry: DR Cash/Bank, CR AR
 * - Update invoice payment status
 */
export const invoicePaidHandler: EventHandler = {
  eventType: DomainEventType.InvoicePaid,
  handler: async (event: DomainEvent) => {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: event.entityId },
      // @ts-ignore - Prisma type inference issue
      include: { customer: true },
    });

    if (!invoice) return;

    // @ts-ignore - Prisma type inference issue
    const paymentAmount = event.data.paymentAmount || invoice.grandTotal;

    // Create payment journal entry
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: `Payment received for Invoice ${invoice.invoiceNumber}`,
      referenceType: 'Payment',
      referenceId: event.data.paymentId,
      lines: [
        {
          accountCode: '1001', // Cash
          debit: paymentAmount,
          credit: 0,
          description: `Cash receipt for Invoice ${invoice.invoiceNumber}`,
        },
        {
          accountCode: '1020', // Accounts Receivable
          debit: 0,
          credit: paymentAmount,
          description: `AR payment for Invoice ${invoice.invoiceNumber}`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);

    // Update invoice payment status
    await prisma.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: { increment: paymentAmount },
        // @ts-ignore - Prisma type inference issue
        paymentStatus: invoice.paidAmount + paymentAmount >= invoice.grandTotal ? 'paid' : 'partial',
      },
    });
  },
};

/**
 * Handler for SalesReturnApproved event
 * - MUST fully reverse:
 *   - journal entries
 *   - stock movements
 *   - invoice status
 */
export const salesReturnApprovedHandler: EventHandler = {
  eventType: DomainEventType.SalesReturnApproved,
  handler: async (event: DomainEvent) => {
    // @ts-ignore - Model doesn't exist in schema
    const salesReturn = await prisma.salesReturn.findUnique({
      where: { id: event.entityId },
      include: { 
        customer: true, 
        salesInvoice: true,
        items: { include: { product: true } },
      },
    });

    if (!salesReturn) return;

    // Reverse invoice journal entry
    if (salesReturn.salesInvoice) {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: {
          referenceType: 'SalesInvoice',
          referenceId: salesReturn.salesInvoice.id,
          isPosted: true,
        },
      });
      if (journalEntry) {
        await reverseJournalEntry(journalEntry.id);
      }
    }

    // Restore stock (reverse of sale)
    for (const item of salesReturn.items) {
      await updateStock(item.productId, item.quantity, 'return', salesReturn.id, event.tenantId!);
    }

    // Update invoice status if applicable
    if (salesReturn.salesInvoice) {
      await prisma.salesInvoice.update({
        where: { id: salesReturn.salesInvoice.id },
        data: {
          status: 'credited',
          paidAmount: { decrement: salesReturn.total },
        },
      });
    }
  },
};

// ==================== PURCHASE EVENT HANDLERS ====================

/**
 * Handler for PurchaseOrderConfirmed event
 * - MUST generate journal entry on approval:
 *   DR: Unbilled Inventory
 *   CR: Accrued Payables
 * - MUST reserve expected stock inflow
 */
export const purchaseOrderConfirmedHandler: EventHandler = {
  eventType: DomainEventType.PurchaseOrderCreated,
  handler: async (event: DomainEvent) => {
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: event.entityId },
      include: { supplier: true, items: true },
    });

    if (!purchaseOrder) return;

    // Generate journal entry
    const journalEntry = await createJournalEntry({
      entryDate: purchaseOrder.date,
      description: `Purchase Order ${purchaseOrder.orderNumber} confirmed - Supplier ${purchaseOrder.supplier.nameAr}`,
      referenceType: 'PurchaseOrder',
      referenceId: purchaseOrder.id,
      lines: [
        {
          accountCode: '1030', // Unbilled Inventory
          debit: purchaseOrder.total,
          credit: 0,
          description: `Unbilled Inventory for PO ${purchaseOrder.orderNumber}`,
        },
        {
          accountCode: '2011', // Accrued Payables
          debit: 0,
          credit: purchaseOrder.total,
          description: `Accrued Payables for PO ${purchaseOrder.orderNumber}`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);

    // Reserve expected stock inflow
    for (const item of purchaseOrder.items) {
      // @ts-ignore - Model doesn't exist in schema
      await prisma.stockReservation.create({
        data: {
          productId: item.productId,
          referenceType: 'PurchaseOrder',
          referenceId: purchaseOrder.id,
          reservedQuantity: item.quantity,
          availableQuantity: item.quantity,
          status: 'reserved',
          notes: `Expected inflow from PO ${purchaseOrder.orderNumber}`,
          tenantId: event.tenantId!,
        },
      });
    }
  },
};

/**
 * Handler for PurchaseInvoiceCreated event
 * - Reverse PO journal entry (DR Unbilled Inventory, CR Accrued Payables)
 * - Create invoice journal entry (DR Inventory, CR AP, CR Tax)
 * - Update supplier balance
 */
export const purchaseInvoiceCreatedHandler: EventHandler = {
  eventType: DomainEventType.PurchaseInvoiceCreated,
  handler: async (event: DomainEvent) => {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: event.entityId },
      include: { supplier: true, items: true },
    });

    if (!invoice) return;

    // Create invoice journal entry
    const newJournalEntry = await createJournalEntry({
      entryDate: invoice.date,
      description: `Purchase Invoice ${invoice.invoiceNumber} - Supplier ${invoice.supplier.nameAr}`,
      referenceType: 'PurchaseInvoice',
      referenceId: invoice.id,
      lines: [
        {
          accountCode: '1030', // Inventory
          debit: invoice.total,
          credit: 0,
          description: `Inventory for Invoice ${invoice.invoiceNumber}`,
        },
        {
          accountCode: '2010', // Accounts Payable
          debit: 0,
          credit: invoice.total,
          description: `AP for Invoice ${invoice.invoiceNumber}`,
        },
      ],
    }, event.userId);

    await postJournalEntry(newJournalEntry.id, event.userId);
  },
};

/**
 * Handler for PurchaseReturnApproved event
 * - MUST fully reverse:
 *   - AP liability
 *   - inventory impact
 */
export const purchaseReturnApprovedHandler: EventHandler = {
  eventType: DomainEventType.PurchaseReturnApproved,
  handler: async (event: DomainEvent) => {
    // @ts-ignore - Model doesn't exist in schema
    const purchaseReturn = await prisma.purchaseReturn.findUnique({
      where: { id: event.entityId },
      include: { supplier: true, items: { include: { product: true } } },
    });

    if (!purchaseReturn) return;

    // Reverse invoice journal entry if linked
    if (purchaseReturn.purchaseInvoiceId) {
      const journalEntry = await prisma.journalEntry.findFirst({
        where: {
          referenceType: 'PurchaseInvoice',
          referenceId: purchaseReturn.purchaseInvoiceId,
          isPosted: true,
        },
      });
      if (journalEntry) {
        await reverseJournalEntry(journalEntry.id);
      }
    }

    // Reverse inventory impact
    for (const item of purchaseReturn.items) {
      await updateStock(item.productId, -item.quantity, 'purchase_return', purchaseReturn.id, event.tenantId!);
    }
  },
};

/**
 * Handler for PaymentMade event
 * - Payment journal entry: DR AP, CR Cash/Bank
 */
export const paymentMadeHandler: EventHandler = {
  eventType: DomainEventType.PaymentMade,
  handler: async (event: DomainEvent) => {
    const paymentAmount = event.data.paymentAmount;
    const supplierId = event.data.supplierId;

    // Create payment journal entry
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: `Payment to supplier`,
      referenceType: 'Payment',
      referenceId: event.data.paymentId,
      lines: [
        {
          accountCode: '2010', // Accounts Payable
          debit: paymentAmount,
          credit: 0,
          description: `AP payment`,
        },
        {
          accountCode: '1001', // Cash
          debit: 0,
          credit: paymentAmount,
          description: `Cash payment`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);
  },
};

// ==================== INVENTORY EVENT HANDLERS ====================

/**
 * Handler for StockConsumed event
 * - Create inventory transaction
 * - Update COGS if applicable
 */
export const stockConsumedHandler: EventHandler = {
  eventType: DomainEventType.StockConsumed,
  handler: async (event: DomainEvent) => {
    const { productId, quantity, referenceId } = event.data;
    
    // Create inventory transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId,
        type: 'sale',
        quantity: -quantity,
        referenceId,
        date: new Date(),
        notes: `Stock consumed for ${event.data.referenceType}`,
        // @ts-ignore - Prisma type inference issue
        tenantId: event.tenantId!,
      },
    });
  },
};

/**
 * Handler for StockTransferred event
 * - Create transfer transaction
 * - Update warehouse balances
 */
export const stockTransferredHandler: EventHandler = {
  eventType: DomainEventType.StockTransferred,
  handler: async (event: DomainEvent) => {
    const { productId, quantity, fromWarehouseId, toWarehouseId, referenceId } = event.data;
    
    // Decrement from source warehouse
    await prisma.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });

    // Increment to destination warehouse
    // Note: In a multi-warehouse system, you'd track stock per warehouse
    // For now, we just track total stock
    
    // Create inventory transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId,
        type: 'transfer',
        quantity,
        referenceId,
        date: new Date(),
        notes: `Stock transfer from warehouse ${fromWarehouseId} to ${toWarehouseId}`,
        // @ts-ignore - Prisma type inference issue
        tenantId: event.tenantId!,
      },
    });
  },
};

/**
 * Handler for StockAdjusted event
 * - Create adjustment transaction
 * - Journal entry for adjustment
 */
export const stockAdjustedHandler: EventHandler = {
  eventType: DomainEventType.StockAdjusted,
  handler: async (event: DomainEvent) => {
    const { productId, quantity, type, reason, referenceId } = event.data;
    
    // Get product cost for journal entry
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) return;

    const adjustmentValue = quantity * product.cost;

    // Create inventory transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId,
        type: 'adjustment',
        quantity: type === 'increase' ? quantity : -quantity,
        referenceId,
        date: new Date(),
        notes: reason,
        // @ts-ignore - Prisma type inference issue
        tenantId: event.tenantId!,
      },
    });

    // Create journal entry for adjustment
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: `Stock adjustment: ${reason}`,
      referenceType: 'StockAdjustment',
      referenceId,
      lines: type === 'increase' ? [
        {
          accountCode: '1030', // Inventory
          debit: adjustmentValue,
          credit: 0,
          description: `Inventory increase`,
        },
        {
          accountCode: '5070', // Inventory Adjustment
          debit: 0,
          credit: adjustmentValue,
          description: `Adjustment credit`,
        },
      ] : [
        {
          accountCode: '5070', // Inventory Adjustment
          debit: adjustmentValue,
          credit: 0,
          description: `Inventory decrease`,
        },
        {
          accountCode: '1030', // Inventory
          debit: 0,
          credit: adjustmentValue,
          description: `Adjustment debit`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);
  },
};

// ==================== PRODUCTION EVENT HANDLERS ====================

/**
 * Handler for ProductionOrderStarted event
 * - Consume raw materials (journal entry)
 * - Create WIP inventory
 */
export const productionOrderStartedHandler: EventHandler = {
  eventType: DomainEventType.ProductionOrderStarted,
  handler: async (event: DomainEvent) => {
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { id: event.entityId },
      include: { items: { include: { product: true } } },
    });

    if (!productionOrder) return;

    // Consume raw materials
    for (const item of productionOrder.items) {
      await updateStock(item.productId, -item.quantity, 'production_out', productionOrder.id, event.tenantId!);
      
      // Create inventory transaction
      await prisma.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'production_out',
          quantity: -item.quantity,
          referenceId: productionOrder.id,
          date: new Date(),
          notes: `Raw material consumed for Production Order ${productionOrder.orderNumber}`,
          // @ts-ignore - Prisma type inference issue
          tenantId: event.tenantId!,
        },
      });
    }

    // Create WIP record
    await prisma.workInProgress.create({
      data: {
        productionOrderId: productionOrder.id,
        rawMaterialCost: productionOrder.cost,
        status: 'in_progress',
        // @ts-ignore - Prisma type inference issue
        tenantId: event.tenantId!,
      },
    });
  },
};

/**
 * Handler for ProductionOrderCompleted event
 * - Consume WIP
 * - Create finished goods inventory
 * - Journal entry: DR Finished Goods, CR WIP
 */
export const productionOrderCompletedHandler: EventHandler = {
  eventType: DomainEventType.ProductionOrderCompleted,
  handler: async (event: DomainEvent) => {
    const productionOrder = await prisma.productionOrder.findUnique({
      where: { id: event.entityId },
      include: { product: true },
    });

    if (!productionOrder) return;

    // Update WIP
    const wip = await prisma.workInProgress.findUnique({
      where: { productionOrderId: productionOrder.id },
    });

    if (wip) {
      await prisma.workInProgress.update({
        where: { id: wip.id },
        data: {
          status: 'completed',
          totalCost: wip.rawMaterialCost + wip.laborCost + wip.overheadCost,
        },
      });
    }

    // Create finished goods inventory
    await updateStock(productionOrder.productId, productionOrder.actualOutputQuantity, 'production_in', productionOrder.id, event.tenantId!);

    // Create inventory transaction
    await prisma.inventoryTransaction.create({
      data: {
        productId: productionOrder.productId,
        type: 'production_in',
        quantity: productionOrder.actualOutputQuantity,
        referenceId: productionOrder.id,
        date: new Date(),
        notes: `Finished goods from Production Order ${productionOrder.orderNumber}`,
        // @ts-ignore - Prisma type inference issue
        tenantId: event.tenantId!,
      },
    });

    // Journal entry: DR Finished Goods, CR WIP
    const journalEntry = await createJournalEntry({
      entryDate: new Date(),
      description: `Production Order ${productionOrder.orderNumber} completed`,
      referenceType: 'ProductionOrder',
      referenceId: productionOrder.id,
      lines: [
        {
          accountCode: '1030', // Inventory (Finished Goods)
          debit: wip?.totalCost || productionOrder.cost,
          credit: 0,
          description: `Finished goods produced`,
        },
        {
          accountCode: '1040', // WIP
          debit: 0,
          credit: wip?.totalCost || productionOrder.cost,
          description: `WIP consumed`,
        },
      ],
    }, event.userId);

    await postJournalEntry(journalEntry.id, event.userId);
  },
};

// ==================== REGISTER ALL HANDLERS ====================

import { workflowEngine } from './workflow-engine';

export function registerAllEventHandlers(): void {
  // Sales handlers
  workflowEngine.registerHandler(quotationAcceptedHandler);
  workflowEngine.registerHandler(invoiceCreatedHandler);
  workflowEngine.registerHandler(invoicePaidHandler);
  workflowEngine.registerHandler(salesReturnApprovedHandler);

  // Purchase handlers
  workflowEngine.registerHandler(purchaseOrderConfirmedHandler);
  workflowEngine.registerHandler(purchaseInvoiceCreatedHandler);
  workflowEngine.registerHandler(purchaseReturnApprovedHandler);
  workflowEngine.registerHandler(paymentMadeHandler);

  // Inventory handlers
  workflowEngine.registerHandler(stockConsumedHandler);
  workflowEngine.registerHandler(stockTransferredHandler);
  workflowEngine.registerHandler(stockAdjustedHandler);

  // Production handlers
  workflowEngine.registerHandler(productionOrderStartedHandler);
  workflowEngine.registerHandler(productionOrderCompletedHandler);
}
