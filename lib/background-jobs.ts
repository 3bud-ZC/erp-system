/**
 * Background job system
 * Handles inventory recalculation, report generation, payment reconciliation, and notifications
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
}

export type JobHandler<T = any> = (data: T) => Promise<any>;

class JobQueue {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler>();
  private isProcessing = false;

  /**
   * Register a job handler
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add a job to the queue
   */
  async addJob<T>(type: string, data: T): Promise<string> {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: Job<T> = {
      id,
      type,
      data,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.jobs.set(id, job);
    this.processQueue();

    return id;
  }

  /**
   * Get job status
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const pendingJobs = Array.from(this.jobs.values())
        .filter(job => job.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt);

      for (const job of pendingJobs) {
        await this.executeJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler registered for job type: ${job.type}`;
      return;
    }

    job.status = 'running';
    job.startedAt = Date.now();

    try {
      const result = await handler(job.data);
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
    } catch (error) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Clean up completed jobs older than specified duration
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.jobs.forEach((job, key) => {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        now - job.completedAt > maxAge
      ) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.jobs.delete(key));
  }
}

// Global job queue instance
export const jobQueue = new JobQueue();

// Register job handlers
jobQueue.registerHandler('inventory-recalculation', async (data: { tenantId: string }) => {
  // Placeholder for inventory recalculation logic
  console.log(`Recalculating inventory for tenant: ${data.tenantId}`);
  return { success: true };
});

jobQueue.registerHandler('report-generation', async (data: { reportType: string; tenantId: string }) => {
  // Placeholder for report generation logic
  console.log(`Generating ${data.reportType} report for tenant: ${data.tenantId}`);
  return { success: true };
});

jobQueue.registerHandler('payment-reconciliation', async (data: { tenantId: string }) => {
  // Placeholder for payment reconciliation logic
  console.log(`Reconciling payments for tenant: ${data.tenantId}`);
  return { success: true };
});

jobQueue.registerHandler('send-notification', async (data: { userId: string; message: string }) => {
  // Placeholder for notification sending logic
  console.log(`Sending notification to user ${data.userId}: ${data.message}`);
  return { success: true };
});

// Cleanup old jobs periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    jobQueue.cleanup();
  }, 60 * 60 * 1000); // Every hour
}

/**
 * Convenience functions for common background jobs
 */
export const backgroundJobs = {
  /**
   * Queue inventory recalculation
   */
  async recalculateInventory(tenantId: string): Promise<string> {
    return jobQueue.addJob('inventory-recalculation', { tenantId });
  },

  /**
   * Queue report generation
   */
  async generateReport(reportType: string, tenantId: string): Promise<string> {
    return jobQueue.addJob('report-generation', { reportType, tenantId });
  },

  /**
   * Queue payment reconciliation
   */
  async reconcilePayments(tenantId: string): Promise<string> {
    return jobQueue.addJob('payment-reconciliation', { tenantId });
  },

  /**
   * Queue notification
   */
  async sendNotification(userId: string, message: string): Promise<string> {
    return jobQueue.addJob('send-notification', { userId, message });
  },
};
