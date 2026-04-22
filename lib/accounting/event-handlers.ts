/**
 * Accounting Event Handlers
 * Integrates accounting system with event-driven architecture
 */

import { EventHandler } from '../events/event-bus';
import { DomainEvent } from '../events/domain-events';
import {
  isSalesInvoiceCreated,
  isPurchaseCreated,
  isPaymentReceived,
  isStockUpdated,
  isJournalEntryPosted,
} from '../events/domain-events';
import { accountingService } from './accounting.service';
import { EventFactory } from '../events/domain-events';

// ============================================================================
// SALES INVOICE CREATED HANDLER
// ============================================================================

export class SalesInvoiceAccountingHandler implements EventHandler {
  eventType = 'SalesInvoiceCreated';

  async handle(event: DomainEvent): Promise<void> {
    if (!isSalesInvoiceCreated(event)) {
      return;
    }

    const { data, tenantId, id: eventId, metadata } = event;

    try {
      // Create accounting entry for sales
      await accountingService.recordSales({
        tenantId,
        invoiceId: data.invoiceId,
        invoiceNumber: data.invoiceNumber,
        customerId: data.customerId,
        invoiceDate: data.date,
        items: data.items,
        total: data.total,
        costOfGoodsSold: this.calculateCOGS(data.items), // Would be calculated from product costs
        sourceEventId: eventId,
        correlationId: metadata.correlationId,
        createdBy: metadata.userId,
      });
    } catch (error) {
      console.error(`Failed to create accounting entry for sales invoice ${data.invoiceId}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }

  private calculateCOGS(items: any[]): number {
    // In production, this would calculate actual COGS from product costs
    // For now, estimate as 60% of total
    const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    return total * 0.6;
  }
}

// ============================================================================
// PURCHASE CREATED HANDLER
// ============================================================================

export class PurchaseAccountingHandler implements EventHandler {
  eventType = 'PurchaseCreated';

  async handle(event: DomainEvent): Promise<void> {
    if (!isPurchaseCreated(event)) {
      return;
    }

    const { data, tenantId, id: eventId, metadata } = event;

    try {
      // Create accounting entry for purchase
      await accountingService.recordPurchase({
        tenantId,
        purchaseId: data.purchaseId,
        purchaseNumber: data.purchaseNumber,
        supplierId: data.supplierId,
        purchaseDate: data.date,
        items: data.items,
        total: data.total,
        sourceEventId: eventId,
        correlationId: metadata.correlationId,
        createdBy: metadata.userId,
      });
    } catch (error) {
      console.error(`Failed to create accounting entry for purchase ${data.purchaseId}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}

// ============================================================================
// PAYMENT RECEIVED HANDLER
// ============================================================================

export class PaymentAccountingHandler implements EventHandler {
  eventType = 'PaymentReceived';

  async handle(event: DomainEvent): Promise<void> {
    if (!isPaymentReceived(event)) {
      return;
    }

    const { data, tenantId, id: eventId, metadata } = event;

    try {
      // Create accounting entry for payment
      await accountingService.recordPayment({
        tenantId,
        paymentId: data.paymentId,
        paymentDate: data.paymentDate,
        amount: data.amount,
        customerId: data.customerId,
        supplierId: data.supplierId,
        invoiceId: data.invoiceId,
        invoiceType: data.invoiceType,
        sourceEventId: eventId,
        correlationId: metadata.correlationId,
        createdBy: metadata.userId,
      });
    } catch (error) {
      console.error(`Failed to create accounting entry for payment ${data.paymentId}:`, error);
      throw error; // Re-throw to trigger retry
    }
  }
}

// ============================================================================
// STOCK UPDATED HANDLER
// ============================================================================

export class StockValuationHandler implements EventHandler {
  eventType = 'StockUpdated';

  async handle(event: DomainEvent): Promise<void> {
    if (!isStockUpdated(event)) {
      return;
    }

    const { data, tenantId } = event;

    // Stock valuation adjustments would be handled here
    // For now, this is a placeholder for future enhancement
    // This would create journal entries for inventory revaluation
    // when using FIFO/LIFO or standard costing methods
    
    console.log(`Stock updated for product ${data.productId}: ${data.quantity} (${data.transactionType})`);
    
    // Future implementation:
    // - Calculate valuation change if using moving average
    // - Create journal entry for revaluation if needed
    // - Update inventory valuation accounts
  }
}

// ============================================================================
// JOURNAL ENTRY POSTED HANDLER
// ============================================================================

export class JournalEntryPostedHandler implements EventHandler {
  eventType = 'JournalEntryPosted';

  async handle(event: DomainEvent): Promise<void> {
    if (!isJournalEntryPosted(event)) {
      return;
    }

    const { data, tenantId, metadata } = event;

    // This handler is for side effects after posting
    // For example:
    // - Update financial reports cache
    // - Trigger notifications
    // - Update dashboard metrics
    
    console.log(`Journal entry ${data.entryNumber} posted at ${data.postedAt}`);
    
    // Future implementation:
    // - Invalidate balance caches for affected accounts
    // - Trigger report regeneration
    // - Send notifications to accounting team
  }
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const accountingEventHandlers: EventHandler[] = [
  new SalesInvoiceAccountingHandler(),
  new PurchaseAccountingHandler(),
  new PaymentAccountingHandler(),
  new StockValuationHandler(),
  new JournalEntryPostedHandler(),
];

/**
 * Register accounting event handlers with event bus
 */
export function registerAccountingHandlers(eventBus: any): void {
  for (const handler of accountingEventHandlers) {
    eventBus.subscribe(handler.eventType, handler);
  }
}
