/**
 * Event Handlers
 * Domain-specific handlers for ERP events
 * Integrates with inventory, accounting, and validation systems
 */

import { DomainEvent } from './domain-events';
import { EventHandler } from './event-bus';
import {
  isPurchaseCreated,
  isSalesInvoiceCreated,
  isStockUpdated,
  isPaymentReceived,
  isJournalEntryPosted,
} from './domain-events';
import { prisma } from '../db';

// ============================================================================
// PURCHASE EVENT HANDLERS
// ============================================================================

export class PurchaseCreatedHandler implements EventHandler {
  eventType = 'PurchaseCreated';

  async handle(event: DomainEvent): Promise<void> {
    if (!isPurchaseCreated(event)) {
      return;
    }

    const { data } = event;

    // Side effect: Update inventory
    await this.updateInventory(data, event.tenantId);

    // Side effect: Create accounting entry
    await this.createAccountingEntry(data, event);

    // Side effect: Notify supplier
    await this.notifySupplier(data);
  }

  private async updateInventory(data: any, tenantId: string): Promise<void> {
    const { incrementStockWithTransaction } = await import('../inventory-transactions');
    
    await prisma.$transaction(async (tx) => {
      await incrementStockWithTransaction(
        tx as any,
        data.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        data.purchaseId,
        'purchase',
        tenantId
      );
    });
  }

  private async createAccountingEntry(data: any, event: DomainEvent): Promise<void> {
    const { createJournalEntry } = await import('../accounting');

    await createJournalEntry({
      entryDate: data.date,
      description: `Purchase ${data.purchaseNumber}`,
      referenceType: 'Purchase',
      referenceId: data.purchaseId,
      tenantId: event.tenantId,
      lines: [
        {
          accountCode: '1030', // Inventory
          debit: data.total,
          credit: 0,
          description: 'Purchase inventory',
        },
        {
          accountCode: '2010', // Accounts Payable
          debit: 0,
          credit: data.total,
          description: `Supplier: ${data.supplierId}`,
        },
      ],
    });
  }

  private async notifySupplier(data: any): Promise<void> {
    // Integration with notification service
    console.log(`Notifying supplier ${data.supplierId} about purchase ${data.purchaseNumber}`);
  }
}

// ============================================================================
// SALES EVENT HANDLERS
// ============================================================================

export class SalesInvoiceCreatedHandler implements EventHandler {
  eventType = 'SalesInvoiceCreated';

  async handle(event: DomainEvent): Promise<void> {
    if (!isSalesInvoiceCreated(event)) {
      return;
    }

    const { data } = event;

    // Side effect: Update inventory
    await this.updateInventory(data, event.tenantId);

    // Side effect: Create accounting entry
    await this.createAccountingEntry(data, event);

    // Side effect: Update customer balance
    await this.updateCustomerBalance(data);
  }

  private async updateInventory(data: any, tenantId: string): Promise<void> {
    const { atomicDecrementStock } = await import('../inventory-transactions');
    
    await prisma.$transaction(async (tx) => {
      await atomicDecrementStock(
        tx as any,
        data.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        data.invoiceId,
        'sale',
        tenantId
      );
    });
  }

  private async createAccountingEntry(data: any, event: DomainEvent): Promise<void> {
    const { createJournalEntry } = await import('../accounting');

    await createJournalEntry({
      entryDate: data.date,
      description: `Sales Invoice ${data.invoiceNumber}`,
      referenceType: 'SalesInvoice',
      referenceId: data.invoiceId,
      tenantId: event.tenantId,
      lines: [
        {
          accountCode: '1020', // Accounts Receivable
          debit: data.total,
          credit: 0,
          description: `Customer: ${data.customerId}`,
        },
        {
          accountCode: '4010', // Sales Revenue
          debit: 0,
          credit: data.total,
          description: 'Sales revenue',
        },
      ],
    });
  }

  private async updateCustomerBalance(data: any): Promise<void> {
    // Update customer current balance
    await prisma.customer.update({
      where: { id: data.customerId },
      data: {
        // This would need to be added to schema
        // currentBalance: { increment: data.total }
      },
    } as any);
  }
}

// ============================================================================
// INVENTORY EVENT HANDLERS
// ============================================================================

export class StockUpdatedHandler implements EventHandler {
  eventType = 'StockUpdated';

  async handle(event: DomainEvent): Promise<void> {
    if (!isStockUpdated(event)) {
      return;
    }

    const { data } = event;

    // Side effect: Update inventory valuation
    await this.updateInventoryValuation(data);

    // Side effect: Check low stock alerts
    await this.checkLowStockAlerts(data);

    // Side effect: Update cost layers (FIFO/LIFO)
    await this.updateCostLayers(data);
  }

  private async updateInventoryValuation(data: any): Promise<void> {
    // Update inventory valuation based on new stock levels
    console.log(`Updating inventory valuation for product ${data.productId}`);
  }

  private async checkLowStockAlerts(data: any): Promise<void> {
    // Check if stock is below minimum and create alert
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { minStock: true, code: true },
    });

    if (product && data.quantity < product.minStock) {
      // Create low stock alert
      console.log(`Low stock alert for product ${product.code}: ${data.quantity} < ${product.minStock}`);
    }
  }

  private async updateCostLayers(data: any): Promise<void> {
    // Update FIFO/LIFO cost layers based on transaction type
    console.log(`Updating cost layers for product ${data.productId}`);
  }
}

// ============================================================================
// PAYMENT EVENT HANDLERS
// ============================================================================

export class PaymentReceivedHandler implements EventHandler {
  eventType = 'PaymentReceived';

  async handle(event: DomainEvent): Promise<void> {
    if (!isPaymentReceived(event)) {
      return;
    }

    const { data } = event;

    // Side effect: Allocate payment to invoices
    await this.allocatePayment(data, event.tenantId);

    // Side effect: Create accounting entry
    await this.createAccountingEntry(data, event);

    // Side effect: Update customer/supplier balance
    await this.updateBalance(data);
  }

  private async allocatePayment(data: any, tenantId: string): Promise<void> {
    if (data.invoiceId && data.invoiceType) {
      // Allocate payment to specific invoice
      await prisma.paymentAllocation.create({
        data: {
          paymentId: data.paymentId,
          invoiceId: data.invoiceId,
          invoiceType: data.invoiceType,
          amount: data.amount,
          allocatedAt: data.paymentDate,
          tenantId,
        },
      } as any);
    }
  }

  private async createAccountingEntry(data: any, event: DomainEvent): Promise<void> {
    const { createJournalEntry } = await import('../accounting');

    if (data.customerId) {
      // Customer payment
      await createJournalEntry({
        entryDate: data.paymentDate,
        description: `Payment received`,
        referenceType: 'Payment',
        referenceId: data.paymentId,
        tenantId: event.tenantId,
        lines: [
          {
            accountCode: '1010', // Cash/Bank
            debit: data.amount,
            credit: 0,
            description: 'Payment received',
          },
          {
            accountCode: '1020', // Accounts Receivable
            debit: 0,
            credit: data.amount,
            description: `Customer: ${data.customerId}`,
          },
        ],
      });
    } else if (data.supplierId) {
      // Supplier payment
      await createJournalEntry({
        entryDate: data.paymentDate,
        description: `Payment made`,
        referenceType: 'Payment',
        referenceId: data.paymentId,
        tenantId: event.tenantId,
        lines: [
          {
            accountCode: '2010', // Accounts Payable
            debit: data.amount,
            credit: 0,
            description: `Supplier: ${data.supplierId}`,
          },
          {
            accountCode: '1010', // Cash/Bank
            debit: 0,
            credit: data.amount,
            description: 'Payment made',
          },
        ],
      });
    }
  }

  private async updateBalance(data: any): Promise<void> {
    // Update customer or supplier balance
    if (data.customerId) {
      await prisma.customer.update({
        where: { id: data.customerId },
        data: {
          // currentBalance: { decrement: data.amount }
        },
      } as any);
    } else if (data.supplierId) {
      await prisma.supplier.update({
        where: { id: data.supplierId },
        data: {
          // currentBalance: { decrement: data.amount }
        },
      } as any);
    }
  }
}

// ============================================================================
// ACCOUNTING EVENT HANDLERS
// ============================================================================

export class JournalEntryPostedHandler implements EventHandler {
  eventType = 'JournalEntryPosted';

  async handle(event: DomainEvent): Promise<void> {
    if (!isJournalEntryPosted(event)) {
      return;
    }

    const { data } = event;

    // Side effect: Update account balances
    await this.updateAccountBalances(data);

    // Side effect: Update balance history
    await this.updateBalanceHistory(data);

    // Side effect: Check accounting period status
    await this.checkAccountingPeriod(data);
  }

  private async updateAccountBalances(data: any): Promise<void> {
    // Update account balances based on journal entry lines
    const journalEntry = await prisma.journalEntry.findUnique({
      where: { id: data.entryId },
      include: { lines: true },
    });

    if (!journalEntry) return;

    for (const line of journalEntry.lines) {
      await prisma.account.update({
        where: { code: line.accountCode },
        data: {
          balance: {
            increment: Number(line.debit) - Number(line.credit),
          },
        },
      } as any);
    }
  }

  private async updateBalanceHistory(data: any): Promise<void> {
    // Create balance history records
    const journalEntry = await prisma.journalEntry.findUnique({
      where: { id: data.entryId },
      include: { lines: true },
    });

    if (!journalEntry) return;

    for (const line of journalEntry.lines) {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      await prisma.accountBalanceHistory.create({
        data: {
          accountCode: line.accountCode,
          balance: debit - credit,
          changeAmount: debit - credit,
          journalEntryId: data.entryId,
          changeType: debit > 0 ? 'debit' : 'credit',
          changedAt: data.postedAt,
        },
      } as any);
    }
  }

  private async checkAccountingPeriod(data: any): Promise<void> {
    // Check if accounting period is still open
    const period = await prisma.accountingPeriod.findFirst({
      where: {
        startDate: { lte: data.postedAt },
        endDate: { gte: data.postedAt },
        status: 'open',
      },
    });

    if (!period) {
      console.warn(`No open accounting period for date ${data.postedAt}`);
    }
  }
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const eventHandlers: EventHandler[] = [
  new PurchaseCreatedHandler(),
  new SalesInvoiceCreatedHandler(),
  new StockUpdatedHandler(),
  new PaymentReceivedHandler(),
  new JournalEntryPostedHandler(),
];

/**
 * Register all handlers with the event bus
 */
export function registerHandlers(eventBus: any): void {
  for (const handler of eventHandlers) {
    eventBus.subscribe(handler.eventType, handler);
  }
}
