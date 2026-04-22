/**
 * Domain Events for ERP System
 * Type-safe event definitions for all ERP actions
 */

// ============================================================================
// EVENT BASE TYPES
// ============================================================================

export interface DomainEvent {
  id: string;
  eventType: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  metadata: EventMetadata;
  occurredAt: Date;
}

export interface EventMetadata {
  userId?: string;
  requestId?: string;
  correlationId?: string;
  causationId?: string;
  source: string;
  tags?: Record<string, string>;
}

export enum EventStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

// ============================================================================
// PURCHASE EVENTS
// ============================================================================

export interface PurchaseCreatedData {
  purchaseId: string;
  purchaseNumber: string;
  supplierId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  date: Date;
}

export interface PurchasePostedData {
  purchaseId: string;
  purchaseNumber: string;
  journalEntryId: string;
  postedAt: Date;
}

export interface PurchaseCancelledData {
  purchaseId: string;
  purchaseNumber: string;
  reason: string;
  cancelledAt: Date;
}

// ============================================================================
// SALES EVENTS
// ============================================================================

export interface SalesInvoiceCreatedData {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  date: Date;
}

export interface SalesInvoicePostedData {
  invoiceId: string;
  invoiceNumber: string;
  journalEntryId: string;
  postedAt: Date;
}

export interface SalesInvoicePaidData {
  invoiceId: string;
  invoiceNumber: string;
  paymentId: string;
  amount: number;
  paidAt: Date;
}

export interface SalesInvoiceCancelledData {
  invoiceId: string;
  invoiceNumber: string;
  reason: string;
  cancelledAt: Date;
}

// ============================================================================
// INVENTORY EVENTS
// ============================================================================

export interface StockUpdatedData {
  productId: string;
  productCode: string;
  quantity: number;
  previousQuantity: number;
  transactionType: 'purchase' | 'sale' | 'production_in' | 'production_out' | 'adjustment' | 'return' | 'purchase_return';
  referenceId: string;
  warehouseId?: string;
  updatedAt: Date;
}

export interface StockTransferCreatedData {
  transferId: string;
  transferNumber: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  date: Date;
}

export interface StockTransferCompletedData {
  transferId: string;
  transferNumber: string;
  completedAt: Date;
}

export interface StockAdjustmentCreatedData {
  adjustmentId: string;
  adjustmentNumber: string;
  productId: string;
  quantity: number;
  reason: string;
  date: Date;
}

// ============================================================================
// PAYMENT EVENTS
// ============================================================================

export interface PaymentReceivedData {
  paymentId: string;
  customerId?: string;
  supplierId?: string;
  amount: number;
  paymentDate: Date;
  invoiceId?: string;
  invoiceType?: 'sales' | 'purchase';
}

export interface PaymentAllocatedData {
  paymentId: string;
  invoiceId: string;
  invoiceType: string;
  amount: number;
  allocatedAt: Date;
}

export interface PaymentReconciledData {
  paymentId: string;
  reconciledAt: Date;
}

// ============================================================================
// ACCOUNTING EVENTS
// ============================================================================

export interface JournalEntryCreatedData {
  entryId: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  referenceType?: string;
  referenceId?: string;
  totalDebit: number;
  totalCredit: number;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
  }>;
}

export interface JournalEntryPostedData {
  entryId: string;
  entryNumber: string;
  postedAt: Date;
}

export interface JournalEntryReversedData {
  entryId: string;
  entryNumber: string;
  reversalEntryId: string;
  reversalEntryNumber: string;
  reversedAt: Date;
  reason: string;
}

// ============================================================================
// CUSTOMER/SUPPLIER EVENTS
// ============================================================================

export interface CustomerCreatedData {
  customerId: string;
  customerCode: string;
  nameAr: string;
  nameEn?: string;
  creditLimit: number;
  createdAt: Date;
}

export interface SupplierCreatedData {
  supplierId: string;
  supplierCode: string;
  nameAr: string;
  nameEn?: string;
  creditLimit: number;
  createdAt: Date;
}

// ============================================================================
// EVENT FACTORY
// ============================================================================

export class EventFactory {
  static createPurchaseCreated(
    tenantId: string,
    data: PurchaseCreatedData,
    metadata: Partial<EventMetadata> = {}
  ): DomainEvent {
    return {
      id: this.generateEventId(),
      eventType: 'PurchaseCreated',
      tenantId,
      aggregateId: data.purchaseId,
      aggregateType: 'Purchase',
      version: 1,
      data,
      metadata: {
        source: 'erp.purchase',
        ...metadata,
      },
      occurredAt: new Date(),
    };
  }

  static createSalesInvoiceCreated(
    tenantId: string,
    data: SalesInvoiceCreatedData,
    metadata: Partial<EventMetadata> = {}
  ): DomainEvent {
    return {
      id: this.generateEventId(),
      eventType: 'SalesInvoiceCreated',
      tenantId,
      aggregateId: data.invoiceId,
      aggregateType: 'SalesInvoice',
      version: 1,
      data,
      metadata: {
        source: 'erp.sales',
        ...metadata,
      },
      occurredAt: new Date(),
    };
  }

  static createStockUpdated(
    tenantId: string,
    data: StockUpdatedData,
    metadata: Partial<EventMetadata> = {}
  ): DomainEvent {
    return {
      id: this.generateEventId(),
      eventType: 'StockUpdated',
      tenantId,
      aggregateId: data.productId,
      aggregateType: 'Product',
      version: 1,
      data,
      metadata: {
        source: 'erp.inventory',
        ...metadata,
      },
      occurredAt: new Date(),
    };
  }

  static createPaymentReceived(
    tenantId: string,
    data: PaymentReceivedData,
    metadata: Partial<EventMetadata> = {}
  ): DomainEvent {
    return {
      id: this.generateEventId(),
      eventType: 'PaymentReceived',
      tenantId,
      aggregateId: data.paymentId,
      aggregateType: 'Payment',
      version: 1,
      data,
      metadata: {
        source: 'erp.payments',
        ...metadata,
      },
      occurredAt: new Date(),
    };
  }

  static createJournalEntryPosted(
    tenantId: string,
    data: JournalEntryPostedData,
    metadata: Partial<EventMetadata> = {}
  ): DomainEvent {
    return {
      id: this.generateEventId(),
      eventType: 'JournalEntryPosted',
      tenantId,
      aggregateId: data.entryId,
      aggregateType: 'JournalEntry',
      version: 1,
      data,
      metadata: {
        source: 'erp.accounting',
        ...metadata,
      },
      occurredAt: new Date(),
    };
  }

  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// EVENT TYPE GUARDS
// ============================================================================

export function isPurchaseCreated(event: DomainEvent): event is DomainEvent & { data: PurchaseCreatedData } {
  return event.eventType === 'PurchaseCreated';
}

export function isSalesInvoiceCreated(event: DomainEvent): event is DomainEvent & { data: SalesInvoiceCreatedData } {
  return event.eventType === 'SalesInvoiceCreated';
}

export function isStockUpdated(event: DomainEvent): event is DomainEvent & { data: StockUpdatedData } {
  return event.eventType === 'StockUpdated';
}

export function isPaymentReceived(event: DomainEvent): event is DomainEvent & { data: PaymentReceivedData } {
  return event.eventType === 'PaymentReceived';
}

export function isJournalEntryPosted(event: DomainEvent): event is DomainEvent & { data: JournalEntryPostedData } {
  return event.eventType === 'JournalEntryPosted';
}
