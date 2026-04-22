/**
 * HEALTH INTELLIGENCE ENGINE
 * 
 * Scores system health 0-100 based on:
 * - API latency
 * - DB response time
 * - Error rate
 * - Memory usage
 * - Cache hit ratio
 * 
 * Status levels:
 * - HEALTHY (85-100)
 * - DEGRADED (60-84)
 * - CRITICAL (<60)
 */

import { logger } from '@/lib/logger';
import { cacheRegistry } from './adaptive-cache';
import { circuitBreakerRegistry } from './circuit-breaker';

export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

interface HealthMetric {
  name: string;
  value: number;
  weight: number;
  score: number;
  threshold: {
    healthy: number;
    degraded: number;
  };
  status: 'good' | 'warning' | 'critical';
  details?: Record<string, any>;
}

interface ServiceHealth {
  name: string;
  score: number;
  status: SystemHealthStatus;
  metrics: HealthMetric[];
  lastCheck: number;
}

interface SystemHealthReport {
  overallScore: number;
  overallStatus: SystemHealthStatus;
  timestamp: number;
  services: ServiceHealth[];
  degradingFactors: string[];
  recommendations: string[];
}

interface HealthCheckConfig {
  checkInterval: number;
  apiLatencyThreshold: { healthy: number; degraded: number };
  dbLatencyThreshold: { healthy: number; degraded: number };
  errorRateThreshold: { healthy: number; degraded: number };
  memoryThreshold: { healthy: number; degraded: number };
  cacheHitRateThreshold: { healthy: number; degraded: number };
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  checkInterval: 30000, // 30 seconds
  apiLatencyThreshold: { healthy: 100, degraded: 500 }, // ms
  dbLatencyThreshold: { healthy: 50, degraded: 200 },    // ms
  errorRateThreshold: { healthy: 0.01, degraded: 0.05 }, // 1%, 5%
  memoryThreshold: { healthy: 70, degraded: 85 },       // %
  cacheHitRateThreshold: { healthy: 0.8, degraded: 0.5 }, // 80%, 50%
};

class HealthIntelligenceEngine {
  private config: HealthCheckConfig;
  private metricsHistory: Array<{
    timestamp: number;
    apiLatency: number;
    dbLatency: number;
    errorRate: number;
    memoryUsage: number;
    cacheHitRate: number;
  }> = [];
  private errorCount = 0;
  private totalRequests = 0;
  private apiLatencies: number[] = [];
  private dbLatencies: number[] = [];
  private lastReport: SystemHealthReport | null = null;
  private onStatusChangeCallbacks: Array<(oldStatus: SystemHealthStatus, newStatus: SystemHealthStatus) => void> = [];
  private currentStatus: SystemHealthStatus = 'UNKNOWN';

  constructor(config: Partial<HealthCheckConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHealthMonitoring();
    logger.info('Health intelligence engine initialized');
  }

  /**
   * Record API latency
   */
  recordApiLatency(latencyMs: number): void {
    this.apiLatencies.push(latencyMs);
    
    // Keep only last 1000 samples
    if (this.apiLatencies.length > 1000) {
      this.apiLatencies.shift();
    }
  }

  /**
   * Record DB latency
   */
  recordDbLatency(latencyMs: number): void {
    this.dbLatencies.push(latencyMs);
    
    if (this.dbLatencies.length > 1000) {
      this.dbLatencies.shift();
    }
  }

  /**
   * Record request outcome
   */
  recordRequest(success: boolean): void {
    this.totalRequests++;
    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * Get current system health report
   */
  async getHealthReport(): Promise<SystemHealthReport> {
    const services: ServiceHealth[] = [];
    const degradingFactors: string[] = [];
    const recommendations: string[] = [];

    // 1. API Service Health
    const apiHealth = this.calculateApiHealth();
    services.push(apiHealth);
    if (apiHealth.status !== 'HEALTHY') {
      degradingFactors.push(`API latency: ${apiHealth.metrics[0].value.toFixed(0)}ms`);
      recommendations.push('Consider enabling response caching');
    }

    // 2. Database Health
    const dbHealth = this.calculateDbHealth();
    services.push(dbHealth);
    if (dbHealth.status !== 'HEALTHY') {
      degradingFactors.push(`DB latency: ${dbHealth.metrics[0].value.toFixed(0)}ms`);
      recommendations.push('Check for slow queries, consider query optimization');
    }

    // 3. Error Rate Health
    const errorHealth = this.calculateErrorHealth();
    services.push(errorHealth);
    if (errorHealth.status !== 'HEALTHY') {
      degradingFactors.push(`Error rate: ${(errorHealth.metrics[0].value * 100).toFixed(1)}%`);
      recommendations.push('Review error logs, implement circuit breakers');
    }

    // 4. Memory Health
    const memoryHealth = this.calculateMemoryHealth();
    services.push(memoryHealth);
    if (memoryHealth.status !== 'HEALTHY') {
      degradingFactors.push(`Memory usage: ${memoryHealth.metrics[0].value.toFixed(1)}%`);
      recommendations.push('Clear caches, check for memory leaks');
    }

    // 5. Cache Health
    const cacheHealth = this.calculateCacheHealth();
    services.push(cacheHealth);
    if (cacheHealth.status !== 'HEALTHY') {
      degradingFactors.push(`Cache hit rate: ${(cacheHealth.metrics[0].value * 100).toFixed(1)}%`);
      recommendations.push('Review cache TTLs, increase cache coverage');
    }

    // 6. Circuit Breaker Health
    const circuitHealth = this.calculateCircuitHealth();
    services.push(circuitHealth);

    // Calculate overall score (weighted average)
    const totalWeight = services.reduce((sum, s) => sum + s.metrics.reduce((mSum, m) => mSum + m.weight, 0), 0);
    const weightedSum = services.reduce((sum, s) => {
      return sum + s.metrics.reduce((mSum, m) => mSum + (m.score * m.weight), 0);
    }, 0);
    
    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const overallStatus = this.scoreToStatus(overallScore);

    // Detect status changes
    if (this.currentStatus !== overallStatus) {
      this.onStatusChangeCallbacks.forEach(cb => cb(this.currentStatus, overallStatus));
      this.currentStatus = overallStatus;
      
      logger.warn({
        oldStatus: this.currentStatus,
        newStatus: overallStatus,
        score: overallScore,
        degradingFactors,
      }, 'System health status changed');
    }

    const report: SystemHealthReport = {
      overallScore: Math.round(overallScore),
      overallStatus,
      timestamp: Date.now(),
      services,
      degradingFactors,
      recommendations,
    };

    this.lastReport = report;
    return report;
  }

  /**
   * Calculate API health
   */
  private calculateApiHealth(): ServiceHealth {
    const p95Latency = this.calculateP95(this.apiLatencies);
    const weight = 25;

    let score: number;
    let status: 'good' | 'warning' | 'critical';

    if (p95Latency <= this.config.apiLatencyThreshold.healthy) {
      score = 100;
      status = 'good';
    } else if (p95Latency <= this.config.apiLatencyThreshold.degraded) {
      score = 100 - ((p95Latency - this.config.apiLatencyThreshold.healthy) / 
        (this.config.apiLatencyThreshold.degraded - this.config.apiLatencyThreshold.healthy)) * 40;
      status = 'warning';
    } else {
      score = Math.max(0, 60 - ((p95Latency - this.config.apiLatencyThreshold.degraded) / 100) * 60);
      status = 'critical';
    }

    return {
      name: 'API',
      score: Math.round(score),
      status: this.scoreToStatus(score),
      lastCheck: Date.now(),
      metrics: [{
        name: 'P95 Latency',
        value: p95Latency,
        weight,
        score,
        threshold: this.config.apiLatencyThreshold,
        status,
        details: {
          sampleSize: this.apiLatencies.length,
          avgLatency: this.apiLatencies.reduce((a, b) => a + b, 0) / this.apiLatencies.length || 0,
        },
      }],
    };
  }

  /**
   * Calculate DB health
   */
  private calculateDbHealth(): ServiceHealth {
    const p95Latency = this.calculateP95(this.dbLatencies);
    const weight = 25;

    let score: number;
    let status: 'good' | 'warning' | 'critical';

    if (p95Latency <= this.config.dbLatencyThreshold.healthy) {
      score = 100;
      status = 'good';
    } else if (p95Latency <= this.config.dbLatencyThreshold.degraded) {
      score = 100 - ((p95Latency - this.config.dbLatencyThreshold.healthy) / 
        (this.config.dbLatencyThreshold.degraded - this.config.dbLatencyThreshold.healthy)) * 40;
      status = 'warning';
    } else {
      score = Math.max(0, 60 - ((p95Latency - this.config.dbLatencyThreshold.degraded) / 100) * 60);
      status = 'critical';
    }

    return {
      name: 'Database',
      score: Math.round(score),
      status: this.scoreToStatus(score),
      lastCheck: Date.now(),
      metrics: [{
        name: 'P95 Latency',
        value: p95Latency,
        weight,
        score,
        threshold: this.config.dbLatencyThreshold,
        status,
        details: {
          sampleSize: this.dbLatencies.length,
          avgLatency: this.dbLatencies.reduce((a, b) => a + b, 0) / this.dbLatencies.length || 0,
        },
      }],
    };
  }

  /**
   * Calculate error rate health
   */
  private calculateErrorHealth(): ServiceHealth {
    const errorRate = this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0;
    const weight = 25;

    let score: number;
    let status: 'good' | 'warning' | 'critical';

    if (errorRate <= this.config.errorRateThreshold.healthy) {
      score = 100;
      status = 'good';
    } else if (errorRate <= this.config.errorRateThreshold.degraded) {
      score = 100 - ((errorRate - this.config.errorRateThreshold.healthy) / 
        (this.config.errorRateThreshold.degraded - this.config.errorRateThreshold.healthy)) * 40;
      status = 'warning';
    } else {
      score = Math.max(0, 60 - ((errorRate - this.config.errorRateThreshold.degraded) * 1000));
      status = 'critical';
    }

    return {
      name: 'Error Rate',
      score: Math.round(score),
      status: this.scoreToStatus(score),
      lastCheck: Date.now(),
      metrics: [{
        name: 'Error Rate',
        value: errorRate,
        weight,
        score,
        threshold: this.config.errorRateThreshold,
        status,
        details: {
          totalRequests: this.totalRequests,
          errorCount: this.errorCount,
        },
      }],
    };
  }

  /**
   * Calculate memory health
   */
  private calculateMemoryHealth(): ServiceHealth {
    const memoryUsage = process.memoryUsage();
    const usedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const weight = 15;

    let score: number;
    let status: 'good' | 'warning' | 'critical';

    if (usedPercent <= this.config.memoryThreshold.healthy) {
      score = 100;
      status = 'good';
    } else if (usedPercent <= this.config.memoryThreshold.degraded) {
      score = 100 - ((usedPercent - this.config.memoryThreshold.healthy) / 
        (this.config.memoryThreshold.degraded - this.config.memoryThreshold.healthy)) * 40;
      status = 'warning';
    } else {
      score = Math.max(0, 60 - ((usedPercent - this.config.memoryThreshold.degraded) * 2));
      status = 'critical';
    }

    return {
      name: 'Memory',
      score: Math.round(score),
      status: this.scoreToStatus(score),
      lastCheck: Date.now(),
      metrics: [{
        name: 'Heap Usage',
        value: usedPercent,
        weight,
        score,
        threshold: this.config.memoryThreshold,
        status,
        details: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
        },
      }],
    };
  }

  /**
   * Calculate cache health
   */
  private calculateCacheHealth(): ServiceHealth {
    const allStats = cacheRegistry.getAllStats();
    const caches = Object.values(allStats);
    
    const avgHitRate = caches.length > 0
      ? caches.reduce((sum, s) => sum + s.hitRate, 0) / caches.length
      : 0;
    
    const weight = 10;

    let score: number;
    let status: 'good' | 'warning' | 'critical';

    if (avgHitRate >= this.config.cacheHitRateThreshold.healthy) {
      score = 100;
      status = 'good';
    } else if (avgHitRate >= this.config.cacheHitRateThreshold.degraded) {
      score = 100 - ((this.config.cacheHitRateThreshold.healthy - avgHitRate) / 
        (this.config.cacheHitRateThreshold.healthy - this.config.cacheHitRateThreshold.degraded)) * 40;
      status = 'warning';
    } else {
      score = Math.max(0, 60 - ((this.config.cacheHitRateThreshold.degraded - avgHitRate) * 100));
      status = 'critical';
    }

    return {
      name: 'Cache',
      score: Math.round(score),
      status: this.scoreToStatus(score),
      lastCheck: Date.now(),
      metrics: [{
        name: 'Hit Rate',
        value: avgHitRate,
        weight,
        score,
        threshold: this.config.cacheHitRateThreshold,
        status,
        details: {
          cacheCount: caches.length,
          totalEntries: caches.reduce((sum, s) => sum + s.size, 0),
          totalMemory: caches.reduce((sum, s) => sum + s.memoryUsage, 0),
        },
      }],
    };
  }

  /**
   * Calculate circuit breaker health
   */
  private calculateCircuitHealth(): ServiceHealth {
    const allMetrics = circuitBreakerRegistry.getAllMetrics();
    const breakers = Object.values(allMetrics);
    
    let openCount = 0;
    let halfOpenCount = 0;
    let totalFailureRate = 0;

    breakers.forEach(b => {
      if (b.state === 'OPEN') openCount++;
      if (b.state === 'HALF_OPEN') halfOpenCount++;
      totalFailureRate += b.failureRate || 0;
    });

    const avgFailureRate = breakers.length > 0 ? totalFailureRate / breakers.length : 0;
    
    // Score based on open breakers and failure rates
    let score = 100;
    if (openCount > 0) score -= openCount * 20;
    if (halfOpenCount > 0) score -= halfOpenCount * 10;
    score -= avgFailureRate * 100;
    score = Math.max(0, score);

    const weight = 10;
    const status = score >= 85 ? 'good' : score >= 60 ? 'warning' : 'critical';

    return {
      name: 'Circuit Breakers',
      score: Math.round(score),
      status: this.scoreToStatus(score),
      lastCheck: Date.now(),
      metrics: [{
        name: 'System Health',
        value: avgFailureRate,
        weight,
        score,
        threshold: { healthy: 0.01, degraded: 0.1 },
        status,
        details: {
          totalBreakers: breakers.length,
          open: openCount,
          halfOpen: halfOpenCount,
          closed: breakers.length - openCount - halfOpenCount,
        },
      }],
    };
  }

  /**
   * Calculate P95 from array of values
   */
  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Convert score to status
   */
  private scoreToStatus(score: number): SystemHealthStatus {
    if (score >= 85) return 'HEALTHY';
    if (score >= 60) return 'DEGRADED';
    return 'CRITICAL';
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.getHealthReport();
      } catch (error) {
        logger.error({ error }, 'Health check failed');
      }
    }, this.config.checkInterval);
  }

  /**
   * Register callback for status changes
   */
  onStatusChange(callback: (oldStatus: SystemHealthStatus, newStatus: SystemHealthStatus) => void): void {
    this.onStatusChangeCallbacks.push(callback);
  }

  /**
   * Get last report
   */
  getLastReport(): SystemHealthReport | null {
    return this.lastReport;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.apiLatencies = [];
    this.dbLatencies = [];
    this.errorCount = 0;
    this.totalRequests = 0;
    this.metricsHistory = [];
    this.currentStatus = 'UNKNOWN';
  }
}

// Global instance
export const healthEngine = new HealthIntelligenceEngine();

export { HealthIntelligenceEngine };
export type { SystemHealthReport, ServiceHealth };
export default healthEngine;
