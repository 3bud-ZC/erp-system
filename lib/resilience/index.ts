/**
 * RESILIENCE LAYER - Main Export
 *
 * System Reliability Components:
 * - Circuit Breaker (DB/API protection)
 * - Adaptive Cache (Smart caching)
 * - Health Intelligence (0-100 scoring)
 * - Self-Healing (Auto-recovery)
 * - Stress Test (Load simulation)
 */

import { circuitBreakerRegistry } from './circuit-breaker';
import { cacheRegistry } from './adaptive-cache';
import { healthEngine } from './health-intelligence';
import { selfHealing } from './self-healing';
import { stressTestEngine } from './stress-test';

// Circuit Breaker
export {
  CircuitBreaker,
  circuitBreakerRegistry,
  CircuitBreakerError,
  withCircuitBreaker,
  withCircuitBreakerFn,
} from './circuit-breaker';
export type { CircuitBreakerState } from './circuit-breaker';

// Adaptive Cache
export {
  cacheRegistry,
  withCache,
} from './adaptive-cache';
export type { CacheMode, CacheStats } from './adaptive-cache';

// Health Intelligence
export {
  HealthIntelligenceEngine,
  healthEngine,
} from './health-intelligence';
export type { SystemHealthStatus } from './health-intelligence';

// Self-Healing
export {
  SelfHealingSystem,
  selfHealing,
} from './self-healing';
export type { DegradationLevel } from './self-healing';

// Stress Test
export {
  StressTestEngine,
  stressTestEngine,
  runQuickStressTest,
} from './stress-test';
export type { StressTestType, StressTestResult } from './stress-test';

// Resilience wrapper for easy integration
export class ResilienceLayer {
  /**
   * Execute operation with full resilience stack
   */
  static async execute<T>(
    operation: () => Promise<T>,
    options: {
      circuitBreakerName?: string;
      cacheName?: string;
      cacheKey?: string;
      cacheTTL?: number;
      fallback?: () => T;
    }
  ): Promise<T> {
    let fn = operation;

    // Add circuit breaker if specified
    if (options.circuitBreakerName) {
      const breaker = circuitBreakerRegistry.getOrCreate(options.circuitBreakerName);
      fn = () => breaker.execute(fn, { fallback: options.fallback });
    }

    // Add cache if specified
    if (options.cacheName && options.cacheKey) {
      const cache = cacheRegistry.getOrCreate(options.cacheName);
      fn = () => cache.getOrSet(options.cacheKey!, fn, { ttl: options.cacheTTL });
    }

    return fn();
  }

  /**
   * Get complete system health
   */
  static async getHealth() {
    const health = await healthEngine.getHealthReport();
    const circuits = circuitBreakerRegistry.getAllMetrics();
    const caches = cacheRegistry.getAllStats();
    const healing = selfHealing.getHealingHistory();

    return {
      ...health,
      circuits,
      caches,
      healing: healing.slice(-10), // Last 10 healing actions
    };
  }

  /**
   * Run stress test
   */
  static async runStressTest(preset: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'MEDIUM') {
    return stressTestEngine.runQuickTest(preset);
  }
}

export default ResilienceLayer;
