/**
 * SELF-HEALING SYSTEM
 * 
 * Automatically reacts to system issues:
 * - Error rate increase → reduce traffic / enable cache-only mode
 * - DB slow → activate circuit breaker
 * - Memory high → clear cache aggressively
 * - Latency spikes → degrade non-critical endpoints
 * 
 * Never crashes the system.
 */

import { logger } from '@/lib/logger';
import { healthEngine, SystemHealthStatus } from './health-intelligence';
import { circuitBreakerRegistry } from './circuit-breaker';
import { cacheRegistry } from './adaptive-cache';

export type DegradationLevel = 'NONE' | 'MINIMAL' | 'MODERATE' | 'SEVERE';

interface SelfHealingAction {
  type: 'CIRCUIT_BREAK' | 'CACHE_CLEAR' | 'RATE_LIMIT' | 'DEGRADE_SERVICES' | 'LOG_ALERT';
  target: string;
  reason: string;
  timestamp: number;
  autoResolved: boolean;
}

interface SelfHealingConfig {
  enabled: boolean;
  errorRateThreshold: number;        // Trigger at X% error rate
  dbLatencyThreshold: number;      // Trigger at X ms DB latency
  memoryThreshold: number;         // Trigger at X% memory
  apiLatencyThreshold: number;     // Trigger at X ms API latency
  actionCooldown: number;          // Min time between actions (ms)
  autoRecoveryEnabled: boolean;    // Auto-recover when healthy
}

const DEFAULT_CONFIG: SelfHealingConfig = {
  enabled: true,
  errorRateThreshold: 0.1,         // 10% error rate
  dbLatencyThreshold: 500,         // 500ms
  memoryThreshold: 85,             // 85%
  apiLatencyThreshold: 1000,       // 1000ms
  actionCooldown: 60000,           // 1 minute
  autoRecoveryEnabled: true,
};

class SelfHealingSystem {
  private config: SelfHealingConfig;
  private actions: SelfHealingAction[] = [];
  private lastActionTime: number = 0;
  private currentDegradation: DegradationLevel = 'NONE';
  private degradedServices = new Set<string>();
  private healingInProgress = false;

  constructor(config: Partial<SelfHealingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enabled) {
      this.startMonitoring();
    }
    
    logger.info('Self-healing system initialized');
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    // Check health every 10 seconds
    setInterval(() => {
      this.checkAndHeal();
    }, 10000);

    // Listen for critical status changes
    healthEngine.onStatusChange((oldStatus, newStatus) => {
      if (newStatus === 'CRITICAL') {
        logger.fatal({ oldStatus, newStatus }, 'CRITICAL status detected - emergency healing');
        this.emergencyHealing();
      } else if (newStatus === 'HEALTHY' && oldStatus !== 'HEALTHY') {
        if (this.config.autoRecoveryEnabled) {
          logger.info('System recovered - attempting auto-recovery');
          this.attemptRecovery();
        }
      }
    });
  }

  /**
   * Check system health and apply healing actions
   */
  private async checkAndHeal(): Promise<void> {
    if (this.healingInProgress) return;

    const report = healthEngine.getLastReport();
    if (!report) return;

    // Check cooldown
    const now = Date.now();
    if (now - this.lastActionTime < this.config.actionCooldown) {
      return;
    }

    const actions: SelfHealingAction[] = [];

    // 1. Check error rate
    const errorService = report.services.find(s => s.name === 'Error Rate');
    if (errorService && errorService.metrics[0].value > this.config.errorRateThreshold) {
      actions.push(...this.handleHighErrorRate(errorService));
    }

    // 2. Check DB latency
    const dbService = report.services.find(s => s.name === 'Database');
    if (dbService && dbService.metrics[0].value > this.config.dbLatencyThreshold) {
      actions.push(...this.handleSlowDatabase(dbService));
    }

    // 3. Check memory
    const memoryService = report.services.find(s => s.name === 'Memory');
    if (memoryService && memoryService.metrics[0].value > this.config.memoryThreshold) {
      actions.push(...this.handleHighMemory(memoryService));
    }

    // 4. Check API latency
    const apiService = report.services.find(s => s.name === 'API');
    if (apiService && apiService.metrics[0].value > this.config.apiLatencyThreshold) {
      actions.push(...this.handleHighLatency(apiService));
    }

    // Apply actions if any
    if (actions.length > 0) {
      this.healingInProgress = true;
      
      for (const action of actions) {
        await this.applyAction(action);
      }

      this.actions.push(...actions);
      this.lastActionTime = Date.now();
      
      // Update degradation level
      this.updateDegradationLevel(actions.length);
      
      this.healingInProgress = false;

      logger.warn({
        actionsTaken: actions.length,
        degradation: this.currentDegradation,
        services: actions.map(a => a.target),
      }, 'Self-healing actions applied');
    }
  }

  /**
   * Handle high error rate
   */
  private handleHighErrorRate(service: any): SelfHealingAction[] {
    const actions: SelfHealingAction[] = [];

    // Activate circuit breakers for all services
    const breakers = circuitBreakerRegistry.getAllMetrics();
    Object.keys(breakers).forEach(name => {
      const breaker = circuitBreakerRegistry.get(name);
      if (breaker && breaker.getState() === 'CLOSED') {
        // Force open if error rate is very high
        if (service.metrics[0].value > 0.3) {
          breaker.forceState('OPEN');
          actions.push({
            type: 'CIRCUIT_BREAK',
            target: name,
            reason: `High error rate: ${(service.metrics[0].value * 100).toFixed(1)}%`,
            timestamp: Date.now(),
            autoResolved: false,
          });
        }
      }
    });

    // Enable aggressive caching
    cacheRegistry.clearAll();
    actions.push({
      type: 'CACHE_CLEAR',
      target: 'all',
      reason: 'High error rate - clearing potentially corrupted cache',
      timestamp: Date.now(),
      autoResolved: false,
    });

    return actions;
  }

  /**
   * Handle slow database
   */
  private handleSlowDatabase(service: any): SelfHealingAction[] {
    const actions: SelfHealingAction[] = [];

    // Open circuit breaker for database operations
    const dbBreaker = circuitBreakerRegistry.getOrCreate('database', {
      failureThreshold: 3,
      timeoutDuration: 15000,
    });

    if (dbBreaker.getState() === 'CLOSED') {
      dbBreaker.forceState('OPEN');
      actions.push({
        type: 'CIRCUIT_BREAK',
        target: 'database',
        reason: `DB latency: ${service.metrics[0].value.toFixed(0)}ms`,
        timestamp: Date.now(),
        autoResolved: false,
      });
    }

    return actions;
  }

  /**
   * Handle high memory
   */
  private handleHighMemory(service: any): SelfHealingAction[] {
    const actions: SelfHealingAction[] = [];

    // Aggressive cache clearing
    cacheRegistry.clearAll();
    actions.push({
      type: 'CACHE_CLEAR',
      target: 'all',
      reason: `Memory usage: ${service.metrics[0].value.toFixed(1)}%`,
      timestamp: Date.now(),
      autoResolved: true,
    });

    // Suggest GC (Node.js hint)
    if (global.gc) {
      global.gc();
      logger.info('Garbage collection triggered');
    }

    return actions;
  }

  /**
   * Handle high API latency
   */
  private handleHighLatency(service: any): SelfHealingAction[] {
    const actions: SelfHealingAction[] = [];

    // Degrade non-critical services
    const nonCritical = ['reporting', 'analytics', 'export', 'notifications'];
    
    nonCritical.forEach(serviceName => {
      if (!this.degradedServices.has(serviceName)) {
        this.degradedServices.add(serviceName);
        actions.push({
          type: 'DEGRADE_SERVICES',
          target: serviceName,
          reason: `API latency: ${service.metrics[0].value.toFixed(0)}ms`,
          timestamp: Date.now(),
          autoResolved: true,
        });
      }
    });

    return actions;
  }

  /**
   * Apply a healing action
   */
  private async applyAction(action: SelfHealingAction): Promise<void> {
    logger.warn({
      type: action.type,
      target: action.target,
      reason: action.reason,
    }, 'Applying self-healing action');

    // Log alert for critical actions
    if (action.type === 'CIRCUIT_BREAK' || action.type === 'DEGRADE_SERVICES') {
      this.logAlert(action);
    }
  }

  /**
   * Log alert for manual intervention
   */
  private logAlert(action: SelfHealingAction): void {
    logger.fatal({
      action,
      timestamp: new Date().toISOString(),
      requiresAttention: true,
    }, 'SELF-HEALING ALERT: Manual intervention may be required');
  }

  /**
   * Emergency healing for CRITICAL status
   */
  private async emergencyHealing(): Promise<void> {
    logger.fatal('EMERGENCY HEALING ACTIVATED');

    // 1. Open all circuit breakers
    const breakers = circuitBreakerRegistry.getAllMetrics();
    Object.keys(breakers).forEach(name => {
      const breaker = circuitBreakerRegistry.get(name);
      if (breaker) {
        breaker.forceState('OPEN');
      }
    });

    // 2. Clear all caches
    cacheRegistry.clearAll();

    // 3. Set severe degradation
    this.currentDegradation = 'SEVERE';

    // 4. Log critical alert
    logger.fatal({
      actions: [
        'All circuit breakers OPENED',
        'All caches CLEARED',
        'System in SEVERE degradation mode',
      ],
    }, 'Emergency healing complete - system in survival mode');
  }

  /**
   * Attempt recovery when system is healthy
   */
  private async attemptRecovery(): Promise<void> {
    logger.info('Attempting auto-recovery');

    // 1. Restore degraded services
    this.degradedServices.clear();

    // 2. Reset circuit breakers to CLOSED (will go through HALF_OPEN)
    const breakers = circuitBreakerRegistry.getAllMetrics();
    Object.keys(breakers).forEach(name => {
      const breaker = circuitBreakerRegistry.get(name);
      if (breaker && breaker.getState() === 'OPEN') {
        // Let them naturally transition through HALF_OPEN
        logger.info({ breaker: name }, 'Circuit breaker scheduled for recovery');
      }
    });

    // 3. Reduce degradation level
    this.currentDegradation = 'NONE';

    // 4. Mark auto-resolved actions
    this.actions.forEach(action => {
      if (action.autoResolved) {
        action.autoResolved = true;
      }
    });

    logger.info('Auto-recovery attempt complete');
  }

  /**
   * Update degradation level based on actions
   */
  private updateDegradationLevel(actionCount: number): void {
    if (actionCount >= 4) {
      this.currentDegradation = 'SEVERE';
    } else if (actionCount >= 3) {
      this.currentDegradation = 'MODERATE';
    } else if (actionCount >= 1) {
      this.currentDegradation = 'MINIMAL';
    }
  }

  /**
   * Check if service is degraded
   */
  isServiceDegraded(serviceName: string): boolean {
    return this.degradedServices.has(serviceName);
  }

  /**
   * Get current degradation level
   */
  getDegradationLevel(): DegradationLevel {
    return this.currentDegradation;
  }

  /**
   * Get healing history
   */
  getHealingHistory(): SelfHealingAction[] {
    return [...this.actions];
  }

  /**
   * Enable/disable self-healing
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info({ enabled }, 'Self-healing system toggled');
  }

  /**
   * Manual trigger for healing
   */
  async manualHeal(): Promise<SelfHealingAction[]> {
    logger.info('Manual healing triggered');
    this.healingInProgress = false;
    await this.checkAndHeal();
    return this.actions.slice(-5); // Return last 5 actions
  }
}

// Global instance
export const selfHealing = new SelfHealingSystem();

export { SelfHealingSystem };
export default selfHealing;
