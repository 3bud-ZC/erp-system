/**
 * Registered Event Handlers
 * These handlers are registered with the EventDispatcher to process domain events
 */

import { registerEventHandler } from './event-dispatcher';
import { accountingService } from '../accounting/accounting.service';

// ============================================================================
// SALES INVOICE EVENT HANDLERS
// ============================================================================

registerEventHandler('SalesInvoiceCreated', async (event) => {
  console.log(`Processing SalesInvoiceCreated event: ${event.id}`);
  // This event is already emitted during invoice creation
  // The actual accounting entry is created when the invoice is posted
  // This handler can trigger side effects like notifications
});

registerEventHandler('SalesInvoicePosted', async (event) => {
  console.log(`Processing SalesInvoicePosted event: ${event.id}`);
  // This event is emitted when invoice is posted and journal entry created
  // Can trigger: email notifications, reporting updates, etc.
});

// ============================================================================
// PURCHASE EVENT HANDLERS
// ============================================================================

registerEventHandler('PurchaseCreated', async (event) => {
  console.log(`Processing PurchaseCreated event: ${event.id}`);
  // This event is emitted when purchase invoice is created
  // Can trigger: supplier notifications, PO updates, etc.
});

registerEventHandler('PurchasePosted', async (event) => {
  console.log(`Processing PurchasePosted event: ${event.id}`);
  // This event is emitted when purchase is posted
  // Can trigger: inventory updates, accounting entries, etc.
});

// ============================================================================
// PAYMENT EVENT HANDLERS
// ============================================================================

registerEventHandler('PaymentReceived', async (event) => {
  console.log(`Processing PaymentReceived event: ${event.id}`);
  // This event is emitted when payment is received
  // Can trigger: invoice allocation, customer notifications, etc.
});

registerEventHandler('PaymentAllocated', async (event) => {
  console.log(`Processing PaymentAllocated event: ${event.id}`);
  // This event is emitted when payment is allocated to invoice
  // Can trigger: invoice status updates, balance updates, etc.
});

// ============================================================================
// STOCK EVENT HANDLERS
// ============================================================================

registerEventHandler('StockUpdated', async (event) => {
  console.log(`Processing StockUpdated event: ${event.id}`);
  const { productId, quantity, previousQuantity, transactionType, referenceId } = event.data;

  // Trigger stock valuation update
  // TODO: Implement stock valuation in accounting service
  try {
    // await accountingService.recordStockValuation(
    //   productId,
    //   quantity,
    //   transactionType,
    //   referenceId,
    //   event.tenantId
    // );
  } catch (error) {
    console.error('Error recording stock valuation:', error);
    throw error;
  }
});

// ============================================================================
// JOURNAL ENTRY EVENT HANDLERS
// ============================================================================

registerEventHandler('JournalEntryCreated', async (event) => {
  console.log(`Processing JournalEntryCreated event: ${event.id}`);
  // This event is emitted when journal entry is created
  // Can trigger: balance updates, reporting preparation, etc.
});

registerEventHandler('JournalEntryPosted', async (event) => {
  console.log(`Processing JournalEntryPosted event: ${event.id}`);
  // This event is emitted when journal entry is posted
  // Can trigger: trial balance update, P&L calculation, etc.
});

// ============================================================================
// CUSTOMER/SUPPLIER EVENT HANDLERS
// ============================================================================

registerEventHandler('CustomerCreated', async (event) => {
  console.log(`Processing CustomerCreated event: ${event.id}`);
  // This event is emitted when customer is created
  // Can trigger: welcome email, initial credit setup, etc.
});

registerEventHandler('SupplierCreated', async (event) => {
  console.log(`Processing SupplierCreated event: ${event.id}`);
  // This event is emitted when supplier is created
  // Can trigger: supplier onboarding, credit limit setup, etc.
});

// ============================================================================
// INITIALIZE HANDLERS
// ============================================================================

/**
 * Call this function during application startup to register all handlers
 */
export function initializeEventHandlers(): void {
  console.log('Event handlers registered successfully');
}
