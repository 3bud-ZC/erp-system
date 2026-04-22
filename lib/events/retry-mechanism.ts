/**
 * Retry Mechanism
 * Exponential backoff retry strategy for failed events
 */

import { eventPersistence, OutboxEvent } from './event-persistence';
import { eventBus } from './event-bus';
import { DomainEvent } from './domain-events';

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'EAI_AGAIN',
    '5xx',
    'ValidationError', // Transient validation errors
  ],
};

// ============================================================================
// RETRY MECHANISM
// ============================================================================

export class RetryMechanism {
  private config: RetryConfig;
  private retryQueue: Map<string, RetryEntry>;
  private isProcessing: boolean;

  constructor(config: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config;
    this.retryQueue = new Map();
    this.isProcessing = false;
  }

  /**
   * Add event to retry queue
   */
  async scheduleRetry(eventId: string, error: Error): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) {
      return;
    }

    const delayMs = this.calculateDelay(event.retryCount);
    const retryAt = new Date(Date.now() + delayMs);

    this.retryQueue.set(eventId, {
      eventId,
      retryAt,
      lastError: error,
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processRetryQueue();
    }
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.retryQueue.size > 0) {
        const now = Date.now();
        const readyToRetry: string[] = [];

        // Find events ready to retry
        const entries = Array.from(this.retryQueue.entries());
        for (const [eventId, entry] of entries) {
          if (entry.retryAt.getTime() <= now) {
            readyToRetry.push(eventId);
          }
        }

        if (readyToRetry.length === 0) {
          // Wait for next event to be ready
          const nextRetry = this.getNextRetryTime();
          if (nextRetry) {
            await this.sleep(nextRetry.getTime() - now);
            continue;
          } else {
            break;
          }
        }

        // Retry events
        for (const eventId of readyToRetry) {
          await this.retryEvent(eventId);
          this.retryQueue.delete(eventId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a single event
   */
  private async retryEvent(eventId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) {
      return;
    }

    try {
      // Convert OutboxEvent to DomainEvent
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

      // Publish to event bus
      await eventBus.publish(domainEvent);

      // Mark as processed if successful
      await eventPersistence.markProcessed(eventId);
    } catch (error) {
      // Check if error is retryable
      if (this.isRetryable(error)) {
        event.retryCount = (event.retryCount || 0) + 1;

        if (event.retryCount >= this.config.maxRetries) {
          // Max retries exceeded, mark as failed permanently
          await eventPersistence.markFailed(eventId, error as Error);
        } else {
          // Schedule next retry
          await this.scheduleRetry(eventId, error as Error);
        }
      } else {
        // Non-retryable error, mark as failed permanently
        await eventPersistence.markFailed(eventId, error as Error);
      }
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(retryCount: number): number {
    const delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, retryCount);
    return Math.min(delay, this.config.maxDelayMs);
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';

    // Check error code
    if (this.config.retryableErrors.includes(errorCode)) {
      return true;
    }

    // Check error message
    for (const retryableError of this.config.retryableErrors) {
      if (errorMessage.includes(retryableError)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get next retry time from queue
   */
  private getNextRetryTime(): Date | null {
    let earliest: Date | null = null;

    const entries = Array.from(this.retryQueue.values());
    for (const entry of entries) {
      if (!earliest || entry.retryAt < earliest) {
        earliest = entry.retryAt;
      }
    }

    return earliest;
  }

  /**
   * Get event from persistence
   */
  private async getEvent(eventId: string): Promise<OutboxEvent | undefined> {
    // This would query the database in production
    // For now, we'll return undefined (would be implemented with Prisma)
    return undefined;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry queue size
   */
  getQueueSize(): number {
    return this.retryQueue.size;
  }

  /**
   * Clear retry queue (for testing)
   */
  clear(): void {
    this.retryQueue.clear();
    this.isProcessing = false;
  }
}

// ============================================================================
// RETRY ENTRY INTERFACE
// ============================================================================

interface RetryEntry {
  eventId: string;
  retryAt: Date;
  lastError: Error;
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

export const retryMechanism = new RetryMechanism();
