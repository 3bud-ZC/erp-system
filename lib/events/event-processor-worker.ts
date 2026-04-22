/**
 * Event Processor Worker - Production-Grade Background Worker
 * Polls and processes events from OutboxEvent table
 * Can run as cron job or queue worker
 */

import { eventDispatcher } from './event-dispatcher';

// ============================================================================
// WORKER CONFIGURATION
// ============================================================================

const WORKER_CONFIG = {
  pollIntervalMs: 5000, // 5 seconds
  maxConcurrentBatches: 3,
  shutdownTimeoutMs: 30000, // 30 seconds to complete processing on shutdown
};

// ============================================================================
// EVENT PROCESSOR WORKER
// ============================================================================

export class EventProcessorWorker {
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private resolveShutdown: (() => void) | null = null;

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('EventProcessorWorker is already running');
      return;
    }

    this.isRunning = true;
    console.log('EventProcessorWorker started');

    // Start polling
    this.poll();
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('EventProcessorWorker stopping...');

    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for current processing to complete
    if (this.shutdownPromise) {
      await Promise.race([
        this.shutdownPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), WORKER_CONFIG.shutdownTimeoutMs)
        ),
      ]);
    }

    console.log('EventProcessorWorker stopped');
  }

  /**
   * Poll for pending events and process them
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const stats = await eventDispatcher.getStats();

      if (stats.pending > 0) {
        console.log(`Processing ${stats.pending} pending events...`);

        const result = await eventDispatcher.processAllPendingEvents();
        console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);

        // If there are still pending events, continue immediately
        if (result.processed > 0 && stats.pending > result.processed) {
          this.poll();
          return;
        }
      }
    } catch (error) {
      console.error('Error processing events:', error);
    }

    // Schedule next poll
    if (this.isRunning) {
      this.pollTimer = setTimeout(() => this.poll(), WORKER_CONFIG.pollIntervalMs);
    }
  }

  /**
   * Process events for a specific tenant (useful for tenant-specific processing)
   */
  async processTenantEvents(tenantId: string): Promise<void> {
    const result = await eventDispatcher.processTenantEvents(tenantId);
    console.log(`Tenant ${tenantId} - Processed: ${result.processed}, Failed: ${result.failed}`);
    return;
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; stats: any } {
    return {
      isRunning: this.isRunning,
      stats: null, // Stats would be fetched from eventDispatcher
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const eventProcessorWorker = new EventProcessorWorker();

// ============================================================================
// CLI COMMANDS FOR MANUAL CONTROL
// ============================================================================

/**
 * Manual command to process all pending events once
 */
export async function processEventsOnce(): Promise<void> {
  console.log('Processing pending events...');
  const result = await eventDispatcher.processAllPendingEvents();
  console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
}

/**
 * Manual command to process events for a specific tenant
 */
export async function processTenantEventsOnce(tenantId: string): Promise<void> {
  console.log(`Processing events for tenant ${tenantId}...`);
  const result = await eventDispatcher.processTenantEvents(tenantId);
  console.log(`Processed: ${result.processed}, Failed: ${result.failed}`);
}

/**
 * Manual command to retry failed events
 */
export async function retryFailedEvents(tenantId?: string): Promise<void> {
  console.log('Retrying failed events...');
  const result = await eventDispatcher.retryFailedEvents(tenantId);
  console.log(`Retried: ${result.retried} events`);
}

/**
 * Manual command to get event statistics
 */
export async function getEventStats(): Promise<void> {
  const stats = await eventDispatcher.getStats();
  console.log('Event Statistics:', stats);
}

/**
 * Manual command to get Dead Letter Queue
 */
export async function getDeadLetterQueue(tenantId?: string): Promise<void> {
  const dlq = await eventDispatcher.getDeadLetterQueue(tenantId);
  console.log('Dead Letter Queue:', dlq);
}

/**
 * Manual command to cleanup old processed events
 */
export async function cleanupProcessedEvents(daysOld: number = 30): Promise<void> {
  console.log(`Cleaning up processed events older than ${daysOld} days...`);
  const result = await eventDispatcher.cleanupProcessedEvents(daysOld);
  console.log(`Deleted: ${result.deleted} events`);
}

// ============================================================================
// CRON JOB SCHEDULER (for production)
// ============================================================================
// This would be used with a cron scheduler like node-cron
// Example usage with node-cron:
// import cron from 'node-cron';
// cron.schedule('* * * * *', async () => {
//   await processEventsOnce();
// });

// ============================================================================
// BACKGROUND PROCESSING (for development)
// ============================================================================

/**
 * Start worker in development mode
 * Call this from your development server startup
 */
export function startDevWorker(): void {
  eventProcessorWorker.start().catch(console.error);
  
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, stopping worker...');
    await eventProcessorWorker.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, stopping worker...');
    await eventProcessorWorker.stop();
    process.exit(0);
  });
}
