/**
 * Event Bus Implementation
 * In-memory event bus with pub/sub pattern
 * Supports tenant-specific event ordering
 */

import { DomainEvent, EventMetadata } from './domain-events';

// ============================================================================
// EVENT HANDLER INTERFACE
// ============================================================================

export interface EventHandler {
  eventType: string;
  handle(event: DomainEvent): Promise<void>;
}

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  filter?: (event: DomainEvent) => boolean;
}

// ============================================================================
// EVENT BUS
// ============================================================================

export class EventBus {
  private subscriptions: Map<string, Set<EventHandler>>;
  private tenantQueues: Map<string, DomainEvent[]>;
  private processingLocks: Map<string, boolean>;

  constructor() {
    this.subscriptions = new Map();
    this.tenantQueues = new Map();
    this.processingLocks = new Map();
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.subscriptions.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Publish an event to the bus
   * Events are queued per tenant to ensure ordering
   */
  async publish(event: DomainEvent): Promise<void> {
    // Add to tenant-specific queue
    const tenantId = event.tenantId;
    if (!this.tenantQueues.has(tenantId)) {
      this.tenantQueues.set(tenantId, []);
    }
    this.tenantQueues.get(tenantId)!.push(event);

    // Process tenant queue if not locked
    if (!this.processingLocks.get(tenantId)) {
      await this.processTenantQueue(tenantId);
    }
  }

  /**
   * Publish multiple events atomically
   * All events are queued together to maintain order
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    // Group by tenant
    const tenantGroups = new Map<string, DomainEvent[]>();
    for (const event of events) {
      const tenantId = event.tenantId;
      if (!tenantGroups.has(tenantId)) {
        tenantGroups.set(tenantId, []);
      }
      tenantGroups.get(tenantId)!.push(event);
    }

    // Publish each tenant group
    const entries = Array.from(tenantGroups.entries());
    for (const [tenantId, tenantEvents] of entries) {
      for (const event of tenantEvents) {
        await this.publish(event);
      }
    }
  }

  /**
   * Process tenant-specific event queue
   * Ensures strict ordering per tenant
   */
  private async processTenantQueue(tenantId: string): Promise<void> {
    // Acquire lock
    if (this.processingLocks.get(tenantId)) {
      return; // Already processing
    }
    this.processingLocks.set(tenantId, true);

    try {
      const queue = this.tenantQueues.get(tenantId);
      if (!queue || queue.length === 0) {
        return;
      }

      // Process events in order
      while (queue.length > 0) {
        const event = queue.shift()!;
        await this.dispatchEvent(event);
      }
    } finally {
      // Release lock
      this.processingLocks.set(tenantId, false);
    }
  }

  /**
   * Dispatch event to all subscribed handlers
   */
  private async dispatchEvent(event: DomainEvent): Promise<void> {
    const handlers = this.subscriptions.get(event.eventType);
    if (!handlers) {
      return;
    }

    // Execute all handlers
    const promises = Array.from(handlers).map(handler =>
      this.executeHandler(handler, event)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Execute a single handler with error handling
   */
  private async executeHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      console.error(`Handler error for event ${event.eventType}:`, error);
      // Error is logged but doesn't stop other handlers
      // Failed events will be retried via persistence layer
    }
  }

  /**
   * Get queue size for a tenant
   */
  getQueueSize(tenantId: string): number {
    return this.tenantQueues.get(tenantId)?.length || 0;
  }

  /**
   * Clear all queues (for testing)
   */
  clear(): void {
    this.subscriptions.clear();
    this.tenantQueues.clear();
    this.processingLocks.clear();
  }
}

// ============================================================================
// GLOBAL EVENT BUS INSTANCE
// ============================================================================

export const eventBus = new EventBus();
