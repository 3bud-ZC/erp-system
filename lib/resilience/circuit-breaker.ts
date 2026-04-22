/**
 * PRODUCTION CIRCUIT BREAKER SYSTEM
 * 
 * States: CLOSED → OPEN → HALF_OPEN → CLOSED
 * Protects database, external APIs, and heavy queries from cascading failures
 */

import { logger } from '@/lib/logger';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  consecutiveFailures: number;
  totalRequests: number;
  stateTransitions: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures to trigger OPEN
  successThreshold: number;      // Successes to close from HALF_OPEN
  timeoutDuration: number;       // Cooldown in ms before HALF_OPEN
  halfOpenMaxCalls: number;      // Max calls in HALF_OPEN state
  monitorInterval: number;       // Metrics collection interval
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutDuration: 30000,        // 30 seconds
  halfOpenMaxCalls: 3,
  monitorInterval: 5000,         // 5 seconds
};

class CircuitBreaker {
  private name: string;
  private state: CircuitBreakerState = 'CLOSED';
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;
  private halfOpenCalls: number = 0;
  private fallbackFn?: () => any;
  private lastStateChange: number = Date.now();
  private metricsHistory: Array<{ timestamp: number; failureRate: number }> = [];

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      stateTransitions: 0,
    };

    this.startMetricsCollection();
    logger.info({ circuitBreaker: name }, 'Circuit breaker initialized');
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: {
      fallback?: () => T;
      timeout?: number;
      tags?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Check if circuit is OPEN
    if (this.state === 'OPEN') {
      const timeInOpen = Date.now() - this.lastStateChange;
      
      if (timeInOpen < this.config.timeoutDuration) {
        // Still in cooldown - return fallback or error
        logger.warn({
          circuitBreaker: this.name,
          requestId,
          state: this.state,
          timeInOpen,
          tags: options.tags,
        }, 'Circuit breaker OPEN - request blocked');

        if (options.fallback) {
          return options.fallback();
        }

        if (this.fallbackFn) {
          return this.fallbackFn();
        }

        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.name,
          this.state,
          this.getMetrics()
        );
      } else {
        // Cooldown expired - transition to HALF_OPEN
        this.transitionTo('HALF_OPEN');
      }
    }

    // Check HALF_OPEN call limit
    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      logger.warn({
        circuitBreaker: this.name,
        requestId,
        halfOpenCalls: this.halfOpenCalls,
      }, 'HALF_OPEN call limit reached');

      if (options.fallback) {
        return options.fallback();
      }

      throw new CircuitBreakerError(
        `Circuit breaker '${this.name}' HALF_OPEN limit reached`,
        this.name,
        this.state,
        this.getMetrics()
      );
    }

    // Execute the function
    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await this.executeWithTimeout(fn, options.timeout || 30000);
      this.onSuccess(startTime);
      
      logger.debug({
        circuitBreaker: this.name,
        requestId,
        state: this.state,
        latency: Date.now() - startTime,
        tags: options.tags,
      }, 'Circuit breaker request succeeded');

      return result;
    } catch (error) {
      this.onFailure(startTime, error as Error);
      
      logger.error({
        circuitBreaker: this.name,
        requestId,
        state: this.state,
        error: (error as Error).message,
        latency: Date.now() - startTime,
        tags: options.tags,
      }, 'Circuit breaker request failed');

      // Try fallback on failure
      if (options.fallback) {
        return options.fallback();
      }

      if (this.fallbackFn) {
        return this.fallbackFn();
      }

      throw error;
    }
  }

  /**
   * Execute with timeout protection
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Handle successful execution
   */
  private onSuccess(startTime: number): void {
    this.metrics.successes++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();
    this.metrics.totalRequests++;

    // In HALF_OPEN, enough successes will close the circuit
    if (this.state === 'HALF_OPEN') {
      const recentSuccesses = this.calculateRecentSuccesses();
      if (recentSuccesses >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(startTime: number, error: Error): void {
    this.metrics.failures++;
    this.metrics.consecutiveFailures++;
    this.metrics.lastFailureTime = Date.now();
    this.metrics.totalRequests++;

    // Check if we should open the circuit
    if (this.state === 'CLOSED' && this.metrics.consecutiveFailures >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
    }

    // In HALF_OPEN, any failure reopens the circuit
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    this.metrics.stateTransitions++;

    if (newState === 'HALF_OPEN') {
      this.halfOpenCalls = 0;
    }

    if (newState === 'CLOSED') {
      this.metrics.consecutiveFailures = 0;
    }

    logger.warn({
      circuitBreaker: this.name,
      oldState,
      newState,
      metrics: this.getMetrics(),
    }, `Circuit breaker state transition: ${oldState} → ${newState}`);
  }

  /**
   * Calculate recent success rate for HALF_OPEN evaluation
   */
  private calculateRecentSuccesses(): number {
    // Look at last N requests
    const windowSize = this.config.successThreshold * 2;
    const recentTotal = Math.min(this.metrics.totalRequests, windowSize);
    const recentFailures = Math.min(this.metrics.consecutiveFailures, windowSize);
    
    return recentTotal - recentFailures;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      const failureRate = this.calculateFailureRate();
      this.metricsHistory.push({
        timestamp: Date.now(),
        failureRate,
      });

      // Keep last 60 minutes of history
      const cutoff = Date.now() - 60 * 60 * 1000;
      this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoff);
    }, this.config.monitorInterval);
  }

  /**
   * Calculate current failure rate
   */
  private calculateFailureRate(): number {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.failures / this.metrics.totalRequests;
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      failureRate: this.calculateFailureRate(),
      timeInCurrentState: Date.now() - this.lastStateChange,
      halfOpenCalls: this.halfOpenCalls,
      history: this.metricsHistory.slice(-10), // Last 10 samples
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Force state (for testing/emergencies)
   */
  forceState(state: CircuitBreakerState): void {
    this.transitionTo(state);
  }

  /**
   * Set fallback function
   */
  setFallback(fn: () => any): void {
    this.fallbackFn = fn;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      stateTransitions: 0,
    };
    this.halfOpenCalls = 0;
    this.metricsHistory = [];
    this.transitionTo('CLOSED');
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  public readonly circuitBreaker: string;
  public readonly state: CircuitBreakerState;
  public readonly metrics: any;

  constructor(
    message: string,
    circuitBreaker: string,
    state: CircuitBreakerState,
    metrics: any
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.circuitBreaker = circuitBreaker;
    this.state = state;
    this.metrics = metrics;
  }
}

/**
 * Circuit Breaker Registry
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  getOrCreate(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getAllMetrics() {
    const metrics: Record<string, any> = {};
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    return metrics;
  }

  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

// Global registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Decorator for automatic circuit breaker protection
 */
export function withCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>,
  fallback?: () => any
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const breaker = circuitBreakerRegistry.getOrCreate(name, config);
    
    if (fallback) {
      breaker.setFallback(fallback);
    }

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => originalMethod.apply(this, args), {
        tags: { method: propertyKey },
      });
    };

    return descriptor;
  };
}

/**
 * Convenience function for one-off circuit breaker execution
 */
export async function withCircuitBreakerFn<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    config?: Partial<CircuitBreakerConfig>;
    fallback?: () => T;
    timeout?: number;
  }
): Promise<T> {
  const breaker = circuitBreakerRegistry.getOrCreate(name, options?.config);
  return breaker.execute(fn, {
    fallback: options?.fallback,
    timeout: options?.timeout,
  });
}

export { CircuitBreaker };
export default circuitBreakerRegistry;
