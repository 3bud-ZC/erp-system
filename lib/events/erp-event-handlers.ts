/**
 * ERP Event Handlers with Outbox Pattern
 * Production-grade event emission for all ERP operations
 */

import { prisma } from '../db';

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface ERPEvent {
  eventType: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, any>;
  metadata: {
    correlationId?: string;
    userId?: string;
    source: string;
    timestamp: Date;
  };
}

// ============================================================================
// OUTBOX EVENT SERVICE
// ============================================================================

/**
 * Persist event to outbox table within transaction
 * This ensures events are reliably stored before transaction commit
 */
export async function persistOutboxEvent(
  tx: any,
  event: ERPEvent
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      eventType: event.eventType,
      tenantId: event.tenantId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: 1,
      data: event.data as any,
      metadata: event.metadata as any,
      status: 'pending',
      occurredAt: event.metadata.timestamp,
      correlationId: event.metadata.correlationId,
    },
  });
}

// ============================================================================
// SALES INVOICE EVENT EMITTER
// ============================================================================

export async function emitSalesInvoiceCreatedEvent(
  tx: any,
  invoiceId: string,
  invoiceNumber: string,
  customerId: string,
  items: Array<{ productId: string; quantity: number; price: number; total: number }>,
  total: number,
  date: Date,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'SalesInvoiceCreated',
    tenantId,
    aggregateId: invoiceId,
    aggregateType: 'SalesInvoice',
    data: {
      invoiceId,
      invoiceNumber,
      customerId,
      items,
      total,
      date,
    },
    metadata: {
      correlationId,
      userId,
      source: 'sales-invoice-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

export async function emitSalesInvoicePostedEvent(
  tx: any,
  invoiceId: string,
  invoiceNumber: string,
  tenantId: string,
  correlationId?: string,
  userId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'SalesInvoicePosted',
    tenantId,
    aggregateId: invoiceId,
    aggregateType: 'SalesInvoice',
    data: {
      invoiceId,
      invoiceNumber,
    },
    metadata: {
      correlationId,
      userId,
      source: 'sales-invoice-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

// ============================================================================
// PURCHASE INVOICE EVENT EMITTER
// ============================================================================

export async function emitPurchaseCreatedEvent(
  tx: any,
  purchaseId: string,
  purchaseNumber: string,
  supplierId: string,
  items: Array<{ productId: string; quantity: number; price: number; total: number }>,
  total: number,
  date: Date,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'PurchaseCreated',
    tenantId,
    aggregateId: purchaseId,
    aggregateType: 'PurchaseInvoice',
    data: {
      purchaseId,
      purchaseNumber,
      supplierId,
      items,
      total,
      date,
    },
    metadata: {
      correlationId,
      userId,
      source: 'purchase-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

export async function emitPurchasePostedEvent(
  tx: any,
  purchaseId: string,
  purchaseNumber: string,
  tenantId: string,
  correlationId?: string,
  userId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'PurchasePosted',
    tenantId,
    aggregateId: purchaseId,
    aggregateType: 'PurchaseInvoice',
    data: {
      purchaseId,
      purchaseNumber,
    },
    metadata: {
      correlationId,
      userId,
      source: 'purchase-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

// ============================================================================
// PAYMENT EVENT EMITTER
// ============================================================================

export async function emitPaymentReceivedEvent(
  tx: any,
  paymentId: string,
  amount: number,
  date: Date,
  tenantId: string,
  customerId?: string,
  supplierId?: string,
  invoiceId?: string,
  invoiceType?: 'sales' | 'purchase',
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'PaymentReceived',
    tenantId,
    aggregateId: paymentId,
    aggregateType: 'Payment',
    data: {
      paymentId,
      amount,
      date,
      customerId,
      supplierId,
      invoiceId,
      invoiceType,
    },
    metadata: {
      correlationId,
      userId,
      source: 'payment-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

export async function emitPaymentAllocatedEvent(
  tx: any,
  paymentId: string,
  invoiceId: string,
  invoiceType: string,
  allocatedAmount: number,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'PaymentAllocated',
    tenantId,
    aggregateId: paymentId,
    aggregateType: 'Payment',
    data: {
      paymentId,
      invoiceId,
      invoiceType,
      allocatedAmount,
    },
    metadata: {
      correlationId,
      userId,
      source: 'payment-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

// ============================================================================
// STOCK EVENT EMITTER
// ============================================================================

export async function emitStockUpdatedEvent(
  tx: any,
  productId: string,
  productCode: string,
  quantity: number,
  previousQuantity: number,
  transactionType: string,
  referenceId: string,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'StockUpdated',
    tenantId,
    aggregateId: productId,
    aggregateType: 'Product',
    data: {
      productId,
      productCode,
      quantity,
      previousQuantity,
      transactionType,
      referenceId,
    },
    metadata: {
      correlationId,
      userId,
      source: 'inventory-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

// ============================================================================
// JOURNAL ENTRY EVENT EMITTER
// ============================================================================

export async function emitJournalEntryCreatedEvent(
  tx: any,
  entryId: string,
  entryNumber: string,
  totalDebit: number,
  totalCredit: number,
  entryDate: Date,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'JournalEntryCreated',
    tenantId,
    aggregateId: entryId,
    aggregateType: 'JournalEntry',
    data: {
      entryId,
      entryNumber,
      totalDebit,
      totalCredit,
      entryDate,
    },
    metadata: {
      correlationId,
      userId,
      source: 'accounting-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

export async function emitJournalEntryPostedEvent(
  tx: any,
  entryId: string,
  entryNumber: string,
  postedAt: Date,
  tenantId: string,
  correlationId?: string,
  userId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'JournalEntryPosted',
    tenantId,
    aggregateId: entryId,
    aggregateType: 'JournalEntry',
    data: {
      entryId,
      entryNumber,
      postedAt,
    },
    metadata: {
      correlationId,
      userId,
      source: 'accounting-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

// ============================================================================
// CUSTOMER/SUPPLIER EVENT EMITTERS
// ============================================================================

export async function emitCustomerCreatedEvent(
  tx: any,
  customerId: string,
  customerCode: string,
  customerName: string,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'CustomerCreated',
    tenantId,
    aggregateId: customerId,
    aggregateType: 'Customer',
    data: {
      customerId,
      customerCode,
      customerName,
    },
    metadata: {
      correlationId,
      userId,
      source: 'customer-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}

export async function emitSupplierCreatedEvent(
  tx: any,
  supplierId: string,
  supplierCode: string,
  supplierName: string,
  tenantId: string,
  userId?: string,
  correlationId?: string
): Promise<void> {
  const event: ERPEvent = {
    eventType: 'SupplierCreated',
    tenantId,
    aggregateId: supplierId,
    aggregateType: 'Supplier',
    data: {
      supplierId,
      supplierCode,
      supplierName,
    },
    metadata: {
      correlationId,
      userId,
      source: 'supplier-service',
      timestamp: new Date(),
    },
  };

  await persistOutboxEvent(tx, event);
}
