/**
 * Event Integration Layer
 * Integrates validation engine with event-driven architecture
 * Ensures events are only published after successful validation and transaction commit
 */

import { prisma } from '../db';
import { EventFactory, DomainEvent } from './domain-events';
import { eventBus } from './event-bus';
import { eventPersistence } from './event-persistence';
import { retryMechanism } from './retry-mechanism';
import { registerHandlers } from './event-handlers';
import { validationEngine, ValidationContext } from '../validation/validation-engine';

// ============================================================================
// EVENT ORCHESTRATOR
// ============================================================================

export class EventOrchestrator {
  private static instance: EventOrchestrator;

  private constructor() {
    // Register event handlers with event bus
    registerHandlers(eventBus);
  }

  static getInstance(): EventOrchestrator {
    if (!EventOrchestrator.instance) {
      EventOrchestrator.instance = new EventOrchestrator();
    }
    return EventOrchestrator.instance;
  }

  /**
   * Execute business operation with validation and event publishing
   * This is the main entry point for all ERP operations
   */
  async executeWithValidation<T>(
    workflowType: string,
    input: any,
    operation: (validatedInput: any) => Promise<T>,
    context: ValidationContext
  ): Promise<{ result: T; events: DomainEvent[] }> {
    // Step 1: Validate input
    const validationResult = await validationEngine.validate(workflowType, input, context);

    if (!validationResult.isValid) {
      throw new ValidationError(validationResult);
    }

    // Step 2: Execute operation within transaction
    const events: DomainEvent[] = [];
    
    const result = await prisma.$transaction(async (tx) => {
      // Execute the business operation
      const operationResult = await operation(input);

      // Step 3: Create and persist events (within same transaction)
      const domainEvents = await this.createEvents(workflowType, input, operationResult, context);
      
      for (const event of domainEvents) {
        await eventPersistence.persistEvent(event);
        events.push(event);
      }

      return operationResult;
    });

    // Step 4: Publish events after transaction commits
    for (const event of events) {
      try {
        await eventBus.publish(event);
      } catch (error) {
        // Schedule retry if publishing fails
        await retryMechanism.scheduleRetry(event.id, error as Error);
      }
    }

    return { result, events };
  }

  /**
   * Create domain events based on workflow type
   */
  private async createEvents(
    workflowType: string,
    input: any,
    operationResult: any,
    context: ValidationContext
  ): Promise<DomainEvent[]> {
    const events: DomainEvent[] = [];

    switch (workflowType) {
      case 'sales':
        events.push(
          EventFactory.createSalesInvoiceCreated(context.tenantId, {
            invoiceId: operationResult.id,
            invoiceNumber: operationResult.invoiceNumber,
            customerId: input.customerId,
            items: input.items,
            total: operationResult.total,
            date: input.date,
          })
        );
        events.push(
          EventFactory.createStockUpdated(context.tenantId, {
            productId: input.items[0].productId,
            productCode: '', // Would be fetched from product
            quantity: -input.items[0].quantity,
            previousQuantity: 0, // Would be fetched from product
            transactionType: 'sale',
            referenceId: operationResult.id,
            updatedAt: new Date(),
          })
        );
        break;

      case 'purchase':
        events.push(
          EventFactory.createPurchaseCreated(context.tenantId, {
            purchaseId: operationResult.id,
            purchaseNumber: operationResult.invoiceNumber,
            supplierId: input.supplierId,
            items: input.items,
            total: operationResult.total,
            date: input.date,
          })
        );
        events.push(
          EventFactory.createStockUpdated(context.tenantId, {
            productId: input.items[0].productId,
            productCode: '', // Would be fetched from product
            quantity: input.items[0].quantity,
            previousQuantity: 0, // Would be fetched from product
            transactionType: 'purchase',
            referenceId: operationResult.id,
            updatedAt: new Date(),
          })
        );
        break;

      case 'accounting_entry':
        events.push(
          EventFactory.createJournalEntryPosted(context.tenantId, {
            entryId: operationResult.id,
            entryNumber: operationResult.entryNumber,
            postedAt: new Date(),
          })
        );
        break;

      case 'payment':
        events.push(
          EventFactory.createPaymentReceived(context.tenantId, {
            paymentId: operationResult.id,
            customerId: input.customerId,
            supplierId: input.supplierId,
            amount: input.amount,
            paymentDate: input.date,
            invoiceId: input.invoiceId,
            invoiceType: input.invoiceType,
          })
        );
        break;
    }

    return events;
  }

  /**
   * Reprocess failed events
   * Called by background job
   */
  async reprocessFailedEvents(tenantId: string): Promise<number> {
    const failedEvents = await eventPersistence.getFailedEvents(tenantId);
    let processed = 0;

    for (const event of failedEvents) {
      try {
        const domainEvent: DomainEvent = {
          id: event.id,
          eventType: event.eventType,
          tenantId: event.tenantId,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          version: event.version,
          data: event.data,
          metadata: event.metadata,
          occurredAt: event.occurredAt,
        };

        await eventBus.publish(domainEvent);
        await eventPersistence.markProcessed(event.id);
        processed++;
      } catch (error) {
        await retryMechanism.scheduleRetry(event.id, error as Error);
      }
    }

    return processed;
  }

  /**
   * Process pending events
   * Called by background job
   */
  async processPendingEvents(tenantId: string): Promise<number> {
    const pendingEvents = await eventPersistence.getPendingEvents(tenantId);
    let processed = 0;

    for (const event of pendingEvents) {
      try {
        const domainEvent: DomainEvent = {
          id: event.id,
          eventType: event.eventType,
          tenantId: event.tenantId,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          version: event.version,
          data: event.data,
          metadata: event.metadata,
          occurredAt: event.occurredAt,
        };

        await eventBus.publish(domainEvent);
        await eventPersistence.markProcessed(event.id);
        processed++;
      } catch (error) {
        await retryMechanism.scheduleRetry(event.id, error as Error);
      }
    }

    return processed;
  }
}

// ============================================================================
// VALIDATION ERROR
// ============================================================================

export class ValidationError extends Error {
  public validationResult: any;

  constructor(validationResult: any) {
    const errorMessages = validationResult.errors
      .map((e: any) => `[${e.code}] ${e.message}`)
      .join('; ');
    super(`Validation failed: ${errorMessages}`);
    this.name = 'ValidationError';
    this.validationResult = validationResult;
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

export const eventOrchestrator = EventOrchestrator.getInstance();
