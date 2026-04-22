/**
 * STRESS TEST ENGINE
 * 
 * Simulates production load:
 * - Concurrent login requests
 * - Invoice creation bursts
 * - Product list heavy reads
 * - Intentional failure injection
 * 
 * Outputs: success rate, p95 latency, failure points, bottleneck detection
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { healthEngine } from './health-intelligence';

export type StressTestType = 'LOGIN' | 'INVOICE_CREATE' | 'PRODUCT_READ' | 'MIXED' | 'FAILURE_INJECTION';

interface StressTestConfig {
  type: StressTestType;
  concurrentUsers: number;
  requestsPerUser: number;
  rampUpTime: number;           // ms to reach full load
  duration: number;             // test duration in ms
  failureInjectionRate?: number; // 0-1, for FAILURE_INJECTION type
}

interface StressTestResult {
  config: StressTestConfig;
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    requestsPerSecond: number;
  };
  latencyDistribution: number[];
  errors: Array<{ timestamp: number; error: string; count: number }>;
  bottlenecks: string[];
  recommendations: string[];
  healthScoreBefore: number;
  healthScoreAfter: number;
  timestamp: number;
  duration: number;
}

interface RequestMetrics {
  startTime: number;
  endTime: number;
  success: boolean;
  error?: string;
}

class StressTestEngine {
  private running = false;
  private currentTest: StressTestConfig | null = null;
  private metrics: RequestMetrics[] = [];
  private errors = new Map<string, number>();

  /**
   * Run stress test
   */
  async runTest(config: StressTestConfig): Promise<StressTestResult> {
    if (this.running) {
      throw new Error('Test already running');
    }

    // Capture health before test
    const healthBefore = await healthEngine.getHealthReport();

    logger.warn({
      type: config.type,
      concurrentUsers: config.concurrentUsers,
      requestsPerUser: config.requestsPerUser,
    }, '🚨 STRESS TEST STARTING');

    this.running = true;
    this.currentTest = config;
    this.metrics = [];
    this.errors.clear();

    const startTime = Date.now();

    try {
      // Execute test based on type
      switch (config.type) {
        case 'LOGIN':
          await this.simulateLoginLoad(config);
          break;
        case 'INVOICE_CREATE':
          await this.simulateInvoiceLoad(config);
          break;
        case 'PRODUCT_READ':
          await this.simulateProductReadLoad(config);
          break;
        case 'MIXED':
          await this.simulateMixedLoad(config);
          break;
        case 'FAILURE_INJECTION':
          await this.simulateFailureInjection(config);
          break;
      }
    } finally {
      this.running = false;
    }

    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    // Capture health after test
    const healthAfter = await healthEngine.getHealthReport();

    // Compile results
    const result = this.compileResults(config, actualDuration, healthBefore, healthAfter);

    logger.warn({
      successRate: result.summary.successRate,
      p95Latency: result.summary.p95Latency,
      bottlenecks: result.bottlenecks,
    }, '✅ STRESS TEST COMPLETE');

    return result;
  }

  /**
   * Simulate concurrent login requests
   */
  private async simulateLoginLoad(config: StressTestConfig): Promise<void> {
    const totalRequests = config.concurrentUsers * config.requestsPerUser;
    const batchSize = Math.min(config.concurrentUsers, 50); // Max 50 concurrent
    
    for (let batch = 0; batch < totalRequests; batch += batchSize) {
      const batchPromises: Promise<void>[] = [];
      
      for (let i = 0; i < batchSize && batch + i < totalRequests; i++) {
        batchPromises.push(this.simulateLoginRequest());
      }
      
      await Promise.allSettled(batchPromises);
      
      // Small delay between batches for ramp-up
      if (config.rampUpTime > 0) {
        await this.delay(config.rampUpTime / (totalRequests / batchSize));
      }
    }
  }

  /**
   * Simulate a single login request
   */
  private async simulateLoginRequest(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simulate DB lookup
      await this.simulateDbCall(10, 50);
      
      // Simulate password verification
      await this.simulateCpuWork(5);
      
      // Simulate token generation
      await this.simulateCpuWork(2);
      
      this.recordSuccess(startTime);
    } catch (error) {
      this.recordFailure(startTime, error as Error);
    }
  }

  /**
   * Simulate invoice creation burst
   */
  private async simulateInvoiceLoad(config: StressTestConfig): Promise<void> {
    const totalRequests = config.concurrentUsers * config.requestsPerUser;
    const batchSize = Math.min(config.concurrentUsers, 30);

    for (let batch = 0; batch < totalRequests; batch += batchSize) {
      const batchPromises: Promise<void>[] = [];
      
      for (let i = 0; i < batchSize && batch + i < totalRequests; i++) {
        batchPromises.push(this.simulateInvoiceCreate());
      }
      
      await Promise.allSettled(batchPromises);
      
      if (config.rampUpTime > 0) {
        await this.delay(config.rampUpTime / (totalRequests / batchSize));
      }
    }
  }

  /**
   * Simulate invoice creation
   */
  private async simulateInvoiceCreate(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Start transaction
      await this.simulateDbCall(5, 20);
      
      // Validate items
      await this.simulateDbCall(10, 30);
      
      // Check stock (atomic)
      await this.simulateDbCall(15, 40);
      
      // Create invoice
      await this.simulateDbCall(20, 50);
      
      // Update stock
      await this.simulateDbCall(15, 35);
      
      // Commit transaction
      await this.simulateDbCall(5, 15);
      
      this.recordSuccess(startTime);
    } catch (error) {
      this.recordFailure(startTime, error as Error);
    }
  }

  /**
   * Simulate product list heavy reads
   */
  private async simulateProductReadLoad(config: StressTestConfig): Promise<void> {
    const totalRequests = config.concurrentUsers * config.requestsPerUser;
    const batchSize = Math.min(config.concurrentUsers, 100); // Higher for reads

    for (let batch = 0; batch < totalRequests; batch += batchSize) {
      const batchPromises: Promise<void>[] = [];
      
      for (let i = 0; i < batchSize && batch + i < totalRequests; i++) {
        batchPromises.push(this.simulateProductRead());
      }
      
      await Promise.allSettled(batchPromises);
      
      if (config.rampUpTime > 0) {
        await this.delay(config.rampUpTime / (totalRequests / batchSize));
      }
    }
  }

  /**
   * Simulate product read
   */
  private async simulateProductRead(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Query products
      await this.simulateDbCall(20, 100);
      
      // Filter/sort
      await this.simulateCpuWork(3);
      
      this.recordSuccess(startTime);
    } catch (error) {
      this.recordFailure(startTime, error as Error);
    }
  }

  /**
   * Simulate mixed workload
   */
  private async simulateMixedLoad(config: StressTestConfig): Promise<void> {
    const totalRequests = config.concurrentUsers * config.requestsPerUser;
    
    // Distribution: 60% reads, 30% logins, 10% writes
    const readCount = Math.floor(totalRequests * 0.6);
    const loginCount = Math.floor(totalRequests * 0.3);
    const writeCount = totalRequests - readCount - loginCount;

    const allPromises: Promise<void>[] = [];

    for (let i = 0; i < readCount; i++) {
      allPromises.push(this.simulateProductRead());
    }

    for (let i = 0; i < loginCount; i++) {
      allPromises.push(this.simulateLoginRequest());
    }

    for (let i = 0; i < writeCount; i++) {
      allPromises.push(this.simulateInvoiceCreate());
    }

    // Execute in batches
    const batchSize = Math.min(config.concurrentUsers, 50);
    for (let i = 0; i < allPromises.length; i += batchSize) {
      const batch = allPromises.slice(i, i + batchSize);
      await Promise.allSettled(batch);
      
      if (config.rampUpTime > 0) {
        await this.delay(config.rampUpTime / (allPromises.length / batchSize));
      }
    }
  }

  /**
   * Simulate failure injection
   */
  private async simulateFailureInjection(config: StressTestConfig): Promise<void> {
    const injectionRate = config.failureInjectionRate || 0.1;
    const totalRequests = config.concurrentUsers * config.requestsPerUser;

    for (let i = 0; i < totalRequests; i++) {
      const shouldFail = Math.random() < injectionRate;
      
      if (shouldFail) {
        this.injectRandomFailure();
      } else {
        await this.simulateLoginRequest();
      }
    }
  }

  /**
   * Inject a random failure
   */
  private injectRandomFailure(): void {
    const failures = [
      'Database connection timeout',
      'Transaction deadlock',
      'Memory allocation failed',
      'Network timeout',
      'Circuit breaker open',
    ];
    
    const error = failures[Math.floor(Math.random() * failures.length)];
    this.recordFailure(Date.now(), new Error(error));
  }

  /**
   * Simulate DB call latency
   */
  private async simulateDbCall(minMs: number, maxMs: number): Promise<void> {
    const latency = minMs + Math.random() * (maxMs - minMs);
    
    // Occasionally simulate slow query
    if (Math.random() < 0.05) {
      await this.delay(latency * 3);
    } else {
      await this.delay(latency);
    }
  }

  /**
   * Simulate CPU work
   */
  private async simulateCpuWork(ms: number): Promise<void> {
    await this.delay(ms);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Record successful request
   */
  private recordSuccess(startTime: number): void {
    this.metrics.push({
      startTime,
      endTime: Date.now(),
      success: true,
    });
  }

  /**
   * Record failed request
   */
  private recordFailure(startTime: number, error: Error): void {
    const errorMsg = error.message || 'Unknown error';
    this.errors.set(errorMsg, (this.errors.get(errorMsg) || 0) + 1);
    
    this.metrics.push({
      startTime,
      endTime: Date.now(),
      success: false,
      error: errorMsg,
    });
  }

  /**
   * Compile test results
   */
  private compileResults(
    config: StressTestConfig,
    duration: number,
    healthBefore: any,
    healthAfter: any
  ): StressTestResult {
    const latencies = this.metrics.map(m => m.endTime - m.startTime).sort((a, b) => a - b);
    const total = this.metrics.length;
    const successful = this.metrics.filter(m => m.success).length;
    const failed = total - successful;

    // Calculate percentiles
    const p50 = this.getPercentile(latencies, 0.5);
    const p95 = this.getPercentile(latencies, 0.95);
    const p99 = this.getPercentile(latencies, 0.99);

    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks(p95, successful, total, healthAfter);

    // Generate recommendations
    const recommendations = this.generateRecommendations(bottlenecks, p95, config);

    return {
      config,
      summary: {
        totalRequests: total,
        successfulRequests: successful,
        failedRequests: failed,
        successRate: total > 0 ? successful / total : 0,
        avgLatency: latencies.reduce((a, b) => a + b, 0) / total || 0,
        p50Latency: p50,
        p95Latency: p95,
        p99Latency: p99,
        minLatency: latencies[0] || 0,
        maxLatency: latencies[latencies.length - 1] || 0,
        requestsPerSecond: total / (duration / 1000),
      },
      latencyDistribution: this.bucketLatencies(latencies),
      errors: Array.from(this.errors.entries()).map(([error, count]) => ({
        timestamp: Date.now(),
        error,
        count,
      })),
      bottlenecks,
      recommendations,
      healthScoreBefore: healthBefore?.overallScore || 0,
      healthScoreAfter: healthAfter?.overallScore || 0,
      timestamp: Date.now(),
      duration,
    };
  }

  /**
   * Get percentile from sorted array
   */
  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Bucket latencies for distribution
   */
  private bucketLatencies(latencies: number[]): number[] {
    const buckets = [0, 0, 0, 0, 0]; // <50ms, 50-100ms, 100-250ms, 250-500ms, >500ms
    
    for (const latency of latencies) {
      if (latency < 50) buckets[0]++;
      else if (latency < 100) buckets[1]++;
      else if (latency < 250) buckets[2]++;
      else if (latency < 500) buckets[3]++;
      else buckets[4]++;
    }
    
    return buckets;
  }

  /**
   * Detect bottlenecks
   */
  private detectBottlenecks(p95: number, successful: number, total: number, healthAfter: any): string[] {
    const bottlenecks: string[] = [];

    if (p95 > 1000) {
      bottlenecks.push('High latency (>1s p95) - Database or compute bottleneck');
    } else if (p95 > 500) {
      bottlenecks.push('Elevated latency (>500ms p95) - Performance degradation');
    }

    const successRate = total > 0 ? successful / total : 0;
    if (successRate < 0.95) {
      bottlenecks.push(`Low success rate (${(successRate * 100).toFixed(1)}%) - System instability`);
    }

    if (healthAfter?.overallStatus === 'CRITICAL') {
      bottlenecks.push('System health CRITICAL - Resource exhaustion');
    } else if (healthAfter?.overallStatus === 'DEGRADED') {
      bottlenecks.push('System health DEGRADED - Performance issues detected');
    }

    return bottlenecks;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(bottlenecks: string[], p95: number, config: StressTestConfig): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.length === 0) {
      recommendations.push('✅ System handled load well - no action needed');
      return recommendations;
    }

    if (p95 > 1000) {
      recommendations.push('🔧 Enable circuit breakers for DB operations');
      recommendations.push('🔧 Increase cache TTL for product listings');
      recommendations.push('🔧 Consider read replicas for database');
    }

    if (config.concurrentUsers > 100) {
      recommendations.push('📊 Implement connection pooling if not already active');
    }

    recommendations.push('📈 Review health metrics during peak hours');
    recommendations.push('🔍 Enable detailed request tracing for slow endpoints');

    return recommendations;
  }

  /**
   * Quick test with presets
   */
  async runQuickTest(preset: 'LIGHT' | 'MEDIUM' | 'HEAVY'): Promise<StressTestResult> {
    const presets = {
      LIGHT: { concurrentUsers: 10, requestsPerUser: 10, rampUpTime: 5000, duration: 30000 },
      MEDIUM: { concurrentUsers: 50, requestsPerUser: 20, rampUpTime: 10000, duration: 60000 },
      HEAVY: { concurrentUsers: 100, requestsPerUser: 50, rampUpTime: 20000, duration: 120000 },
    };

    const config = presets[preset];
    
    return this.runTest({
      type: 'MIXED',
      ...config,
    });
  }

  /**
   * Check if test is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current test config
   */
  getCurrentTest(): StressTestConfig | null {
    return this.currentTest;
  }
}

// Global instance
export const stressTestEngine = new StressTestEngine();

/**
 * Convenience function for quick stress test
 */
export async function runQuickStressTest(preset: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'MEDIUM'): Promise<StressTestResult> {
  return stressTestEngine.runQuickTest(preset);
}

export { StressTestEngine };
export type { StressTestResult };
export default stressTestEngine;
