/**
 * LIGHTWEIGHT BACKGROUND JOB SYSTEM
 * Async processing for non-critical operations
 * 
 * Features:
 * - In-memory queue (can upgrade to Redis/Bull for production)
 * - Job retries with exponential backoff
 * - Job status tracking
 * - Automatic cleanup
 */

import { logger } from '@/lib/logger';

/**
 * Job status types
 */
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Job structure
 */
interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Job handler function type
 */
type JobHandler<T> = (data: T) => Promise<void>;

/**
 * Job queue class
 */
class JobQueue {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler<any>>();
  private processing = false;
  private processInterval?: NodeJS.Timeout;
  
  /**
   * Register a job handler
   */
  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
    logger.info({ jobType: type }, 'Job handler registered');
  }
  
  /**
   * Add a job to the queue
   */
  async add<T>(type: string, data: T, options?: {
    maxAttempts?: number;
    delayMs?: number;
  }): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: Job<T> = {
      id,
      type,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: options?.maxAttempts || 3,
      createdAt: new Date(),
    };
    
    this.jobs.set(id, job);
    
    // Delay if specified
    if (options?.delayMs) {
      setTimeout(() => {
        this.processJob(id);
      }, options.delayMs);
    } else {
      // Process immediately (async)
      setImmediate(() => this.processJob(id));
    }
    
    logger.debug({ jobId: id, type }, 'Job added to queue');
    return id;
  }
  
  /**
   * Process a single job
   */
  private async processJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'pending') return;
    
    const handler = this.handlers.get(job.type);
    if (!handler) {
      logger.error({ jobId: id, type: job.type }, 'No handler for job type');
      job.status = 'failed';
      job.error = 'No handler registered';
      return;
    }
    
    job.status = 'processing';
    job.attempts++;
    job.processedAt = new Date();
    
    const startTime = Date.now();
    
    try {
      await handler(job.data);
      
      job.status = 'completed';
      job.completedAt = new Date();
      
      logger.info({
        jobId: id,
        type: job.type,
        duration: Date.now() - startTime,
        attempts: job.attempts,
      }, 'Job completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        job.status = 'pending';
        
        logger.warn({
          jobId: id,
          type: job.type,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          retryDelay: delay,
          error: errorMessage,
        }, 'Job failed, will retry');
        
        setTimeout(() => this.processJob(id), delay);
      } else {
        // Max attempts reached
        job.status = 'failed';
        job.error = errorMessage;
        
        logger.error({
          jobId: id,
          type: job.type,
          attempts: job.attempts,
          error: errorMessage,
        }, 'Job failed permanently');
      }
    }
  }
  
  /**
   * Get job status
   */
  getJobStatus(id: string): Job | undefined {
    return this.jobs.get(id);
  }
  
  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
    
    this.jobs.forEach(job => {
      stats.total++;
      stats[job.status]++;
    });
    
    return stats;
  }
  
  /**
   * Cleanup old completed jobs
   */
  cleanup(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;
    
    this.jobs.forEach((job, id) => {
      if ((job.status === 'completed' || job.status === 'failed') && 
          job.completedAt && job.completedAt.getTime() < cutoff) {
        this.jobs.delete(id);
        cleaned++;
      }
    });
    
    logger.info({ cleaned }, 'Job queue cleanup completed');
    return cleaned;
  }
  
  /**
   * Start periodic cleanup
   */
  startCleanup(intervalMs = 60 * 60 * 1000): void {
    setInterval(() => this.cleanup(), intervalMs);
  }
}

// Export singleton instance
export const jobQueue = new JobQueue();

/**
 * ASYNC AUDIT LOGGING
 * Moves audit logging to background
 */
import { createAuditLog as syncCreateAuditLog } from '@/lib/audit/audit-logger';

/**
 * Queue an audit log entry for async processing
 */
export async function queueAuditLog(entry: Parameters<typeof syncCreateAuditLog>[0]): Promise<string> {
  return jobQueue.add('audit_log', entry);
}

// Register audit log handler
jobQueue.register('audit_log', async (entry: Parameters<typeof syncCreateAuditLog>[0]) => {
  await syncCreateAuditLog(entry);
});

/**
 * ASYNC NOTIFICATIONS
 * Queue notifications for background processing
 */
export async function queueNotification(data: {
  type: 'email' | 'sms' | 'push';
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
}): Promise<string> {
  return jobQueue.add('notification', data, { maxAttempts: 5 });
}

// Register notification handler (placeholder)
jobQueue.register('notification', async (data: {
  type: 'email' | 'sms' | 'push';
  recipient: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
}) => {
  logger.info({ type: data.type, recipient: data.recipient }, 'Processing notification');
  // TODO: Implement actual notification sending
  // - Email via SendGrid/AWS SES
  // - SMS via Twilio
  // - Push via Firebase
});

/**
 * ASYNC REPORT GENERATION
 * Generate large reports in background
 */
export async function queueReportGeneration(data: {
  tenantId: string;
  userId: string;
  reportType: string;
  parameters: Record<string, any>;
}): Promise<string> {
  return jobQueue.add('report_generation', data, { maxAttempts: 2 });
}

// Register report generation handler
jobQueue.register('report_generation', async (data: {
  tenantId: string;
  userId: string;
  reportType: string;
  parameters: Record<string, any>;
}) => {
  logger.info({ reportType: data.reportType, tenantId: data.tenantId }, 'Generating report');
  // TODO: Implement report generation
  // - Query data
  // - Format report
  // - Store file
  // - Notify user
});

/**
 * DATA EXPORT JOBS
 * Handle large data exports async
 */
export async function queueDataExport(data: {
  tenantId: string;
  userId: string;
  entityType: string;
  filters: Record<string, any>;
  format: 'csv' | 'excel' | 'json';
}): Promise<string> {
  return jobQueue.add('data_export', data, { maxAttempts: 2 });
}

jobQueue.register('data_export', async (data: {
  tenantId: string;
  userId: string;
  entityType: string;
  filters: Record<string, any>;
  format: 'csv' | 'excel' | 'json';
}) => {
  logger.info({ entityType: data.entityType, format: data.format }, 'Exporting data');
  // TODO: Implement data export
});

// Start automatic cleanup
jobQueue.startCleanup();

export default jobQueue;
