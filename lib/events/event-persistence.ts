/**
 * Event Persistence Layer
 * Implements outbox pattern for reliable event delivery
 * Ensures events are persisted before publishing
 */

import { prisma } from '../db';
import { DomainEvent, EventStatus } from './domain-events';

// ============================================================================
// PERSISTED EVENT MODEL (would be added to Prisma schema)
// ============================================================================

/*
model OutboxEvent {
  id            String   @id @default(cuid())
  eventType     String
  tenantId      String
  aggregateId   String
  aggregateType String
  version       Int
  data          Json
  metadata      Json
  status        String   @default("pending")
  occurredAt    DateTime
  processedAt   DateTime?
  retryCount    Int      @default(0)
  lastError     String?
  errorMessage  String?
  correlationId String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([tenantId, status])
  @@index([eventType, status])
  @@index([aggregateId, eventType])
  @@index([occurredAt])
  @@index([processedAt])
}
*/

// ============================================================================
// OUTBOX EVENT INTERFACE
// ============================================================================

export interface OutboxEvent {
  id: string;
  eventType: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  metadata: any;
  status: EventStatus;
  occurredAt: Date;
  processedAt?: Date;
  retryCount: number;
  lastError?: string;
  errorMessage?: string;
  correlationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// EVENT PERSISTENCE SERVICE
// ============================================================================

export class EventPersistenceService {
  /**
   * Persist event to outbox table
   * Called within the same transaction as the business operation
   */
  async persistEvent(event: DomainEvent): Promise<OutboxEvent> {
    // For now, we'll use a simple in-memory approach
    // In production, this would be a Prisma create within the transaction
    const outboxEvent: OutboxEvent = {
      id: event.id,
      eventType: event.eventType,
      tenantId: event.tenantId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: event.version,
      data: event.data,
      metadata: event.metadata,
      status: EventStatus.PENDING,
      occurredAt: event.occurredAt,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in memory for now (would be database in production)
    this.inMemoryStore.set(event.id, outboxEvent);

    return outboxEvent;
  }

  /**
   * Mark event as processed
   */
  async markProcessed(eventId: string): Promise<void> {
    const event = this.inMemoryStore.get(eventId);
    if (event) {
      event.status = EventStatus.PROCESSED;
      event.processedAt = new Date();
      event.updatedAt = new Date();
    }
  }

  /**
   * Mark event as failed
   */
  async markFailed(eventId: string, error: Error): Promise<void> {
    const event = this.inMemoryStore.get(eventId);
    if (event) {
      event.status = EventStatus.FAILED;
      event.lastError = error.name;
      event.errorMessage = error.message;
      event.retryCount = (event.retryCount || 0) + 1;
      event.updatedAt = new Date();
    }
  }

  /**
   * Get pending events for a tenant
   */
  async getPendingEvents(tenantId: string, limit: number = 100): Promise<OutboxEvent[]> {
    const allEvents = Array.from(this.inMemoryStore.values());
    return allEvents
      .filter(e => e.tenantId === tenantId && e.status === EventStatus.PENDING)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get failed events for retry
   */
  async getFailedEvents(tenantId: string, limit: number = 100): Promise<OutboxEvent[]> {
    const allEvents = Array.from(this.inMemoryStore.values());
    return allEvents
      .filter(e => e.tenantId === tenantId && e.status === EventStatus.FAILED)
      .filter(e => e.retryCount < 5) // Max 5 retries
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, limit);
  }

  /**
   * Check if event was already processed (idempotency)
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const event = this.inMemoryStore.get(eventId);
    return event?.status === EventStatus.PROCESSED || false;
  }

  /**
   * Check if duplicate event exists for aggregate
   */
  async hasDuplicateEvent(
    aggregateId: string,
    eventType: string,
    occurredAt: Date,
    windowMs: number = 5000
  ): Promise<boolean> {
    const allEvents = Array.from(this.inMemoryStore.values());
    const windowStart = new Date(occurredAt.getTime() - windowMs);
    const windowEnd = new Date(occurredAt.getTime() + windowMs);

    return allEvents.some(
      e =>
        e.aggregateId === aggregateId &&
        e.eventType === eventType &&
        e.occurredAt >= windowStart &&
        e.occurredAt <= windowEnd
    );
  }

  // In-memory store for development (replace with Prisma in production)
  private inMemoryStore: Map<string, OutboxEvent> = new Map();

  clear(): void {
    this.inMemoryStore.clear();
  }
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

export const eventPersistence = new EventPersistenceService();
