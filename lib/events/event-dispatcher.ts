/**
 * Event Dispatcher - Production-Grade Event Processing
 * Processes events from OutboxEvent table with idempotency and retry logic
 */

import { prisma } from '../db';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RETRY_CONFIG = {
  maxRetries: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 2,
};

const PROCESSING_CONFIG = {
  batchSize: 50,
  pollIntervalMs: 5000, // 5 seconds
  processingTimeoutMs: 30000, // 30 seconds per event
};

// ============================================================================
// EVENT HANDLER REGISTRY
// ============================================================================

type EventHandler = (event: any) => Promise<void>;

const eventHandlers: Map<string, EventHandler> = new Map();

export function registerEventHandler(eventType: string, handler: EventHandler): void {
  eventHandlers.set(eventType, handler);
}

export function getEventHandler(eventType: string): EventHandler | undefined {
  return eventHandlers.get(eventType);
}

// ============================================================================
// IDEMPOTENCY GUARD
// ============================================================================

/**
 * Idempotency guard to prevent duplicate event processing
 * Uses processedEvents set to track successfully processed event IDs
 */
const processedEvents = new Set<string>();

export async function isEventProcessed(eventId: string): Promise<boolean> {
  // Check in-memory cache first
  if (processedEvents.has(eventId)) {
    return true;
  }

  // Check database
  const event = await prisma.outboxEvent.findUnique({
    where: { id: eventId },
    select: { status: true },
  });

  return event?.status === 'processed';
}

export async function markEventProcessed(eventId: string): Promise<void> {
  processedEvents.add(eventId);
}

export async function clearProcessedEventCache(): Promise<void> {
  processedEvents.clear();
}

// ============================================================================
// EVENT DISPATCHER
// ============================================================================

export class EventDispatcher {
  /**
   * Process a single event
   */
  async processEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Fetch event
      const event = await prisma.outboxEvent.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      // Check if already processed
      if (event.status === 'processed') {
        return { success: true };
      }

      // Check if failed too many times
      if (event.retryCount >= RETRY_CONFIG.maxRetries) {
        await prisma.outboxEvent.update({
          where: { id: eventId },
          data: {
            status: 'failed',
            errorMessage: 'Max retries exceeded',
          },
        });
        return { success: false, error: 'Max retries exceeded' };
      }

      // Get handler
      const handler = eventHandlers.get(event.eventType);
      if (!handler) {
        throw new Error(`No handler registered for event type: ${event.eventType}`);
      }

      // Update status to processing
      await prisma.outboxEvent.update({
        where: { id: eventId },
        data: { status: 'processing' },
      });

      // Process event with timeout
      await Promise.race([
        handler(event),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Event processing timeout')), PROCESSING_CONFIG.processingTimeoutMs)
        ),
      ]) as Promise<void>;

      // Mark as processed
      await prisma.outboxEvent.update({
        where: { id: eventId },
        data: {
          status: 'processed',
          processedAt: new Date(),
          retryCount: 0,
          lastError: null,
          errorMessage: null,
        },
      });

      // Add to cache
      await markEventProcessed(eventId);

      return { success: true };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      // Get current event state for retry count
      const currentEvent = await prisma.outboxEvent.findUnique({
        where: { id: eventId },
        select: { retryCount: true },
      });
      const retryCount = currentEvent?.retryCount ?? 0;

      // Calculate retry delay with exponential backoff
      const delayMs = Math.min(
        RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount),
        RETRY_CONFIG.maxDelayMs
      );

      // Update event with error
      await prisma.outboxEvent.update({
        where: { id: eventId },
        data: {
          status: 'pending', // Return to pending for retry
          retryCount: { increment: 1 },
          lastError: errorMessage,
          errorMessage: errorMessage,
        },
      });

      // If max retries exceeded, mark as failed
      const updatedEvent = await prisma.outboxEvent.findUnique({
        where: { id: eventId },
        select: { retryCount: true },
      });

      if (updatedEvent && updatedEvent.retryCount >= RETRY_CONFIG.maxRetries) {
        await prisma.outboxEvent.update({
          where: { id: eventId },
          data: { status: 'failed' },
        });
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Process pending events for a specific tenant
   * Events are processed in order per tenant (FIFO by occurredAt)
   */
  async processTenantEvents(tenantId: string): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    // Get pending events for tenant, ordered by occurredAt
    const events = await prisma.outboxEvent.findMany({
      where: {
        tenantId,
        status: 'pending',
      },
      orderBy: { occurredAt: 'asc' },
      take: PROCESSING_CONFIG.batchSize,
    });

    for (const event of events) {
      const result = await this.processEvent(event.id);
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Process all pending events across all tenants
   * Processes events tenant-by-tenant to maintain ordering
   */
  async processAllPendingEvents(): Promise<{ processed: number; failed: number }> {
    let totalProcessed = 0;
    let totalFailed = 0;

    // Get all tenants with pending events
    const tenants = await prisma.outboxEvent.findMany({
      where: { status: 'pending' },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });

    for (const tenant of tenants) {
      const result = await this.processTenantEvents(tenant.tenantId);
      totalProcessed += result.processed;
      totalFailed += result.failed;
    }

    return { processed: totalProcessed, failed: totalFailed };
  }

  /**
   * Get event processing statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    processed: number;
    failed: number;
    byEventType: Record<string, number>;
  }> {
    const [pending, processing, processed, failed, byType] = await Promise.all([
      prisma.outboxEvent.count({ where: { status: 'pending' } }),
      prisma.outboxEvent.count({ where: { status: 'processing' } }),
      prisma.outboxEvent.count({ where: { status: 'processed' } }),
      prisma.outboxEvent.count({ where: { status: 'failed' } }),
      prisma.outboxEvent.groupBy({
        by: ['eventType'],
        where: { status: 'pending' },
        _count: true,
      }),
    ]);

    const byEventType: Record<string, number> = {};
    for (const type of byType) {
      byEventType[type.eventType] = type._count;
    }

    return {
      pending,
      processing,
      processed,
      failed,
      byEventType,
    };
  }

  /**
   * Retry failed events (manual trigger)
   */
  async retryFailedEvents(tenantId?: string): Promise<{ retried: number }> {
    const where: any = {
      status: 'failed',
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const events = await prisma.outboxEvent.findMany({
      where,
      select: { id: true },
    });

    for (const event of events) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'pending',
          retryCount: 0,
          lastError: null,
          errorMessage: null,
        },
      });
    }

    return { retried: events.length };
  }

  /**
   * Move failed events to Dead Letter Queue
   * Failed events are marked with status 'dlq' for manual review
   */
  async moveToDeadLetterQueue(eventId: string): Promise<void> {
    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'dlq',
        errorMessage: 'Moved to Dead Letter Queue for manual review',
      },
    });
  }

  /**
   * Get Dead Letter Queue events
   */
  async getDeadLetterQueue(tenantId?: string): Promise<any[]> {
    const where: any = {
      status: 'dlq',
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    return await prisma.outboxEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
    });
  }

  /**
   * Clean up processed events older than specified days
   */
  async cleanupProcessedEvents(daysOld: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.outboxEvent.deleteMany({
      where: {
        status: 'processed',
        processedAt: {
          lte: cutoffDate,
        },
      },
    });

    return { deleted: result.count };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const eventDispatcher = new EventDispatcher();
