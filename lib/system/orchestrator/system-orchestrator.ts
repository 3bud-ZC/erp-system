/**
 * SYSTEM ORCHESTRATOR
 * 
 * Principal Systems Integration Layer
 * 
 * Responsibilities:
 * - Control system startup
 * - Validate system readiness
 * - Run health + stress checks
 * - Decide if system is SAFE to run
 * - Block system if unstable
 * - Expose final system state clearly
 */

import { logger } from '@/lib/logger';
import { healthEngine, SystemHealthReport, SystemHealthStatus, ServiceHealth } from '@/lib/resilience/health-intelligence';
import { stressTestEngine, StressTestResult } from '@/lib/resilience/stress-test';
import { selfHealing, DegradationLevel } from '@/lib/resilience/self-healing';
import { circuitBreakerRegistry } from '@/lib/resilience/circuit-breaker';
import { cacheRegistry } from '@/lib/resilience/adaptive-cache';
import { prisma } from '@/lib/db';

export type SystemOrchestratorStatus = 'READY' | 'DEGRADED' | 'FAILED' | 'UNKNOWN';

export interface SmokeTestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  critical: boolean;
}

export interface SystemOrchestratorReport {
  status: SystemOrchestratorStatus;
  healthScore: number;
  healthStatus: SystemHealthStatus;
  boot: {
    success: boolean;
    timestamp: number;
    duration: number;
    checks: SmokeTestResult[];
  };
  smokeTest: {
    passed: boolean;
    total: number;
    passedCount: number;
    failedCount: number;
    criticalFailures: number;
    tests: SmokeTestResult[];
  };
  stressTest: {
    run: boolean;
    passed: boolean;
    successRate: number;
    p95Latency: number;
    details?: StressTestResult;
  };
  circuitBreakers: {
    total: number;
    open: number;
    halfOpen: number;
    closed: number;
  };
  cache: {
    mode: string;
    hitRate: number;
    entries: number;
  };
  selfHealing: {
    enabled: boolean;
    degradationLevel: DegradationLevel;
    recentActions: number;
  };
  recommendations: string[];
  warnings: string[];
  timestamp: number;
  version: string;
}

interface OrchestratorConfig {
  minHealthScore: number;          // Minimum health for READY (default 85)
  minHealthScoreDegraded: number;  // Minimum for DEGRADED (default 60)
  smokeTestTimeout: number;        // Per-test timeout (default 5000ms)
  stressTestEnabled: boolean;      // Run stress test on startup
  stressTestPreset: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  minStressSuccessRate: number;  // Minimum stress test success rate (default 0.95)
  blockOnCriticalFailure: boolean; // Exit if critical smoke test fails
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  minHealthScore: 85,
  minHealthScoreDegraded: 60,
  smokeTestTimeout: 5000,
  stressTestEnabled: true,
  stressTestPreset: 'LIGHT',
  minStressSuccessRate: 0.95,
  blockOnCriticalFailure: true,
};

class SystemOrchestrator {
  private config: OrchestratorConfig;
  private lastReport: SystemOrchestratorReport | null = null;
  private isRunning = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info({ config: this.config }, 'System Orchestrator initialized');
  }

  /**
   * RUN COMPLETE SYSTEM VALIDATION
   * This is the main orchestration flow
   */
  async runValidation(): Promise<SystemOrchestratorReport> {
    if (this.isRunning) {
      throw new Error('Orchestrator validation already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    logger.info('══════════════════════════════════════════════════');
    logger.info('  SYSTEM ORCHESTRATOR - STARTING VALIDATION');
    logger.info('══════════════════════════════════════════════════');

    try {
      // 1. RUN BOOT CHECKS (Smoke Tests)
      logger.info('[1/4] Running Boot Checks...');
      const bootResult = await this.runBootChecks();
      this.logBootResult(bootResult);

      // 2. GET HEALTH INTELLIGENCE
      logger.info('[2/4] Gathering Health Intelligence...');
      const healthReport = await healthEngine.getHealthReport();
      this.logHealthResult(healthReport);

      // 3. RUN STRESS TEST (if enabled)
      let stressResult: { run: boolean; passed: boolean; details?: StressTestResult } = {
        run: false,
        passed: false,
      };

      if (this.config.stressTestEnabled && bootResult.success) {
        logger.info('[3/4] Running Stress Test...');
        stressResult = await this.runStressTest();
        this.logStressResult(stressResult);
      } else {
        logger.info('[3/4] Stress Test skipped (disabled or boot failed)');
      }

      // 4. MAKE SYSTEM DECISION
      logger.info('[4/4] Making System Decision...');
      const decision = this.makeDecision(healthReport, bootResult, stressResult);

      // 5. AGGREGATE FINAL REPORT
      const report = this.aggregateReport(
        decision,
        healthReport,
        bootResult,
        stressResult,
        startTime
      );

      this.lastReport = report;
      this.isRunning = false;

      // Log final result
      this.logFinalReport(report);

      return report;

    } catch (error) {
      this.isRunning = false;
      logger.fatal({ error: (error as Error).message }, 'Orchestrator validation failed');
      
      // Return failure report
      return {
        status: 'FAILED',
        healthScore: 0,
        healthStatus: 'CRITICAL',
        boot: { success: false, timestamp: Date.now(), duration: 0, checks: [] },
        smokeTest: { passed: false, total: 0, passedCount: 0, failedCount: 0, criticalFailures: 0, tests: [] },
        stressTest: { run: false, passed: false, successRate: 0, p95Latency: 0 },
        circuitBreakers: { total: 0, open: 0, halfOpen: 0, closed: 0 },
        cache: { mode: 'COLD', hitRate: 0, entries: 0 },
        selfHealing: { enabled: false, degradationLevel: 'NONE', recentActions: 0 },
        recommendations: ['System orchestrator failed - check logs immediately'],
        warnings: ['Critical system failure during validation'],
        timestamp: Date.now(),
        version: '1.0.0',
      };
    }
  }

  /**
   * BOOT CHECKS / SMOKE TESTS
   */
  private async runBootChecks(): Promise<{ success: boolean; duration: number; checks: SmokeTestResult[] }> {
    const checks: SmokeTestResult[] = [];
    const startTime = Date.now();

    // Critical checks - system cannot run without these
    const criticalChecks = [
      { name: 'Database Connection', fn: () => this.checkDatabase(), critical: true },
      { name: 'Environment Variables', fn: () => this.checkEnvironment(), critical: true },
      { name: 'Prisma Client', fn: () => this.checkPrisma(), critical: true },
    ];

    // Non-critical checks - system can run with warnings
    const nonCriticalChecks = [
      { name: 'Circuit Breakers', fn: () => this.checkCircuitBreakers(), critical: false },
      { name: 'Cache System', fn: () => this.checkCache(), critical: false },
      { name: 'Health Engine', fn: () => this.checkHealthEngine(), critical: false },
      { name: 'Self-Healing', fn: () => this.checkSelfHealing(), critical: false },
    ];

    // Run all checks
    for (const check of [...criticalChecks, ...nonCriticalChecks]) {
      const result = await this.runSmokeTest(check.name, check.fn, check.critical);
      checks.push(result);

      // Stop on critical failure if configured
      if (check.critical && !result.passed && this.config.blockOnCriticalFailure) {
        logger.fatal({ check: check.name }, 'Critical smoke test failed - aborting');
        break;
      }
    }

    const duration = Date.now() - startTime;
    const criticalFailures = checks.filter(c => c.critical && !c.passed).length;
    const success = criticalFailures === 0;

    return { success, duration, checks };
  }

  /**
   * Run single smoke test with timeout
   */
  private async runSmokeTest(
    name: string,
    fn: () => Promise<boolean>,
    critical: boolean
  ): Promise<SmokeTestResult> {
    const startTime = Date.now();

    try {
      const passed = await Promise.race([
        fn(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.config.smokeTestTimeout)
        ),
      ]);

      return {
        name,
        passed,
        duration: Date.now() - startTime,
        critical,
      };
    } catch (error) {
      return {
        name,
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message,
        critical,
      };
    }
  }

  /**
   * Individual smoke test implementations
   */
  private async checkDatabase(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkEnvironment(): Promise<boolean> {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    return required.every(key => process.env[key] && process.env[key]!.length > 0);
  }

  private async checkPrisma(): Promise<boolean> {
    try {
      return !!prisma;
    } catch {
      return false;
    }
  }

  private async checkCircuitBreakers(): Promise<boolean> {
    const metrics = circuitBreakerRegistry.getAllMetrics();
    const hasOpen = Object.values(metrics).some(m => m.state === 'OPEN');
    return !hasOpen; // Pass if no breakers are open at startup
  }

  private async checkCache(): Promise<boolean> {
    const stats = cacheRegistry.getAllStats();
    return Object.keys(stats).length >= 0; // Pass if cache system responds
  }

  private async checkHealthEngine(): Promise<boolean> {
    const report = await healthEngine.getHealthReport();
    return report !== null;
  }

  private async checkSelfHealing(): Promise<boolean> {
    return selfHealing.getDegradationLevel() !== null;
  }

  /**
   * RUN STRESS TEST
   */
  private async runStressTest(): Promise<{ run: boolean; passed: boolean; details?: StressTestResult }> {
    try {
      const result = await stressTestEngine.runQuickTest(this.config.stressTestPreset);
      
      const passed = 
        result.summary.successRate >= this.config.minStressSuccessRate &&
        result.bottlenecks.length === 0;

      return {
        run: true,
        passed,
        details: result,
      };
    } catch (error) {
      return {
        run: true,
        passed: false,
      };
    }
  }

  /**
   * SYSTEM DECISION ENGINE
   */
  private makeDecision(
    health: SystemHealthReport,
    boot: { success: boolean; checks: SmokeTestResult[] },
    stress: { run: boolean; passed: boolean; details?: StressTestResult }
  ): SystemOrchestratorStatus {
    const criticalFailures = boot.checks.filter(c => c.critical && !c.passed).length;

    // Decision logic
    
    // FAILED conditions
    if (criticalFailures > 0) {
      logger.fatal('DECISION: FAILED - Critical boot checks failed');
      return 'FAILED';
    }

    if (health.overallScore < this.config.minHealthScoreDegraded) {
      logger.fatal('DECISION: FAILED - Health score below minimum');
      return 'FAILED';
    }

    if (health.overallStatus === 'CRITICAL') {
      logger.fatal('DECISION: FAILED - System health is CRITICAL');
      return 'FAILED';
    }

    // DEGRADED conditions
    if (health.overallScore < this.config.minHealthScore) {
      logger.warn('DECISION: DEGRADED - Health score below READY threshold');
      return 'DEGRADED';
    }

    if (health.overallStatus === 'DEGRADED') {
      logger.warn('DECISION: DEGRADED - System health is DEGRADED');
      return 'DEGRADED';
    }

    if (stress.run && !stress.passed) {
      logger.warn('DECISION: DEGRADED - Stress test did not pass');
      return 'DEGRADED';
    }

    // READY conditions
    if (health.overallScore >= this.config.minHealthScore &&
        boot.success &&
        (!stress.run || stress.passed)) {
      logger.info('DECISION: READY - All systems operational');
      return 'READY';
    }

    logger.warn('DECISION: DEGRADED - Uncertain state');
    return 'DEGRADED';
  }

  /**
   * AGGREGATE FINAL REPORT
   */
  private aggregateReport(
    status: SystemOrchestratorStatus,
    health: SystemHealthReport,
    boot: { success: boolean; duration: number; checks: SmokeTestResult[] },
    stress: { run: boolean; passed: boolean; details?: StressTestResult },
    startTime: number
  ): SystemOrchestratorReport {
    const circuitMetrics = circuitBreakerRegistry.getAllMetrics();
    const cacheStats = cacheRegistry.getAllStats();

    // Calculate cache aggregate
    const cacheCount = Object.keys(cacheStats).length;
    const avgHitRate = cacheCount > 0
      ? Object.values(cacheStats).reduce((sum, s) => sum + s.hitRate, 0) / cacheCount
      : 0;
    const totalEntries = Object.values(cacheStats).reduce((sum, s) => sum + s.size, 0);
    const dominantMode = this.getDominantCacheMode(cacheStats);

    // Calculate circuit breaker stats
    const cbStates = Object.values(circuitMetrics);
    const openCount = cbStates.filter(c => c.state === 'OPEN').length;
    const halfOpenCount = cbStates.filter(c => c.state === 'HALF_OPEN').length;

    // Generate recommendations
    const recommendations = this.generateRecommendations(health, boot, stress, openCount);
    const warnings = this.generateWarnings(health, boot, stress);

    return {
      status,
      healthScore: health.overallScore,
      healthStatus: health.overallStatus,
      boot: {
        success: boot.success,
        timestamp: Date.now(),
        duration: boot.duration,
        checks: boot.checks,
      },
      smokeTest: {
        passed: boot.success,
        total: boot.checks.length,
        passedCount: boot.checks.filter(c => c.passed).length,
        failedCount: boot.checks.filter(c => !c.passed).length,
        criticalFailures: boot.checks.filter(c => c.critical && !c.passed).length,
        tests: boot.checks,
      },
      stressTest: {
        run: stress.run,
        passed: stress.passed,
        successRate: stress.details?.summary.successRate || 0,
        p95Latency: stress.details?.summary.p95Latency || 0,
        details: stress.details,
      },
      circuitBreakers: {
        total: cbStates.length,
        open: openCount,
        halfOpen: halfOpenCount,
        closed: cbStates.length - openCount - halfOpenCount,
      },
      cache: {
        mode: dominantMode,
        hitRate: avgHitRate,
        entries: totalEntries,
      },
      selfHealing: {
        enabled: true,
        degradationLevel: selfHealing.getDegradationLevel(),
        recentActions: selfHealing.getHealingHistory().length,
      },
      recommendations,
      warnings,
      timestamp: Date.now(),
      version: '1.0.0',
    };
  }

  /**
   * Get dominant cache mode
   */
  private getDominantCacheMode(stats: Record<string, { mode: string }>): string {
    const modes = Object.values(stats).map(s => s.mode);
    if (modes.length === 0) return 'WARM';
    
    const counts = modes.reduce((acc: Record<string, number>, mode: string) => {
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0][0];
  }

  /**
   * Generate recommendations based on system state
   */
  private generateRecommendations(
    health: SystemHealthReport,
    boot: { checks: SmokeTestResult[] },
    stress: { run: boolean; details?: StressTestResult },
    openCircuits: number
  ): string[] {
    const recommendations: string[] = [];

    // Health-based recommendations
    if (health.recommendations) {
      recommendations.push(...health.recommendations);
    }

    // Smoke test recommendations
    const failedNonCritical = boot.checks.filter(c => !c.critical && !c.passed);
    if (failedNonCritical.length > 0) {
      recommendations.push(`Review non-critical systems: ${failedNonCritical.map(c => c.name).join(', ')}`);
    }

    // Circuit breaker recommendations
    if (openCircuits > 0) {
      recommendations.push(`${openCircuits} circuit breaker(s) open - services may be unavailable`);
    }

    // Stress test recommendations
    if (stress.run && stress.details) {
      recommendations.push(...stress.details.recommendations);
    }

    return recommendations;
  }

  /**
   * Generate warnings
   */
  private generateWarnings(
    health: SystemHealthReport,
    boot: { success: boolean },
    stress: { run: boolean; passed: boolean }
  ): string[] {
    const warnings: string[] = [];

    if (health.degradingFactors) {
      warnings.push(...health.degradingFactors);
    }

    if (!boot.success) {
      warnings.push('Boot checks had failures');
    }

    if (stress.run && !stress.passed) {
      warnings.push('Stress test did not meet success criteria');
    }

    return warnings;
  }

  /**
   * LOGGING HELPERS
   */
  private logBootResult(boot: { success: boolean; checks: SmokeTestResult[] }): void {
    const passed = boot.checks.filter(c => c.passed).length;
    const total = boot.checks.length;
    
    if (boot.success) {
      logger.info(`✔ Boot Checks: ${passed}/${total} passed`);
    } else {
      logger.error(`✗ Boot Checks: ${passed}/${total} passed`);
    }

    boot.checks.forEach(check => {
      const icon = check.passed ? '✔' : '✗';
      const critical = check.critical ? ' [CRITICAL]' : '';
      logger.info(`  ${icon} ${check.name}${critical} (${check.duration}ms)`);
    });
  }

  private logHealthResult(health: SystemHealthReport): void {
    const icon = health.overallStatus === 'HEALTHY' ? '✔' : 
                 health.overallStatus === 'DEGRADED' ? '⚠' : '✗';
    
    logger.info(`${icon} Health Score: ${health.overallScore}/100 (${health.overallStatus})`);

    health.services.forEach((service: ServiceHealth) => {
      const sIcon = service.status === 'HEALTHY' ? '✔' : 
                    service.status === 'DEGRADED' ? '⚠' : '✗';
      logger.info(`  ${sIcon} ${service.name}: ${service.score}/100`);
    });
  }

  private logStressResult(stress: { run: boolean; passed: boolean; details?: StressTestResult }): void {
    if (!stress.run) {
      logger.info('⚪ Stress Test: Skipped');
      return;
    }

    const icon = stress.passed ? '✔' : '⚠';
    const details = stress.details;

    if (details) {
      logger.info(`${icon} Stress Test: ${(details.summary.successRate * 100).toFixed(1)}% success, ` +
                  `p95: ${details.summary.p95Latency.toFixed(0)}ms`);

      if (details.bottlenecks.length > 0) {
        details.bottlenecks.forEach(b => logger.warn(`  ⚠ ${b}`));
      }
    } else {
      logger.error('✗ Stress Test: Failed to complete');
    }
  }

  private logFinalReport(report: SystemOrchestratorReport): void {
    logger.info('══════════════════════════════════════════════════');
    
    const statusIcon = report.status === 'READY' ? '✅' : 
                       report.status === 'DEGRADED' ? '⚠️' : '❌';
    
    logger.info(`${statusIcon} SYSTEM STATUS: ${report.status}`);
    logger.info(`   Health Score: ${report.healthScore}/100`);
    logger.info(`   Boot: ${report.boot.success ? 'OK' : 'FAILED'}`);
    logger.info(`   Smoke Tests: ${report.smokeTest.passedCount}/${report.smokeTest.total} passed`);
    
    if (report.stressTest.run) {
      logger.info(`   Stress Test: ${report.stressTest.passed ? 'PASS' : 'FAIL'} ` +
                  `(${report.stressTest.successRate.toFixed(1)}%)`);
    }

    if (report.warnings.length > 0) {
      logger.warn('⚠️  WARNINGS:');
      report.warnings.forEach(w => logger.warn(`   - ${w}`));
    }

    if (report.recommendations.length > 0) {
      logger.info('📋 RECOMMENDATIONS:');
      report.recommendations.forEach(r => logger.info(`   - ${r}`));
    }

    logger.info('══════════════════════════════════════════════════');
  }

  /**
   * GET LAST REPORT
   */
  getLastReport(): SystemOrchestratorReport | null {
    return this.lastReport;
  }

  /**
   * START RUNTIME MONITORING
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitorInterval) {
      logger.warn('Monitoring already active');
      return;
    }

    logger.info({ intervalMs }, 'Starting runtime monitoring');

    this.monitorInterval = setInterval(async () => {
      try {
        // Recalculate health
        const health = await healthEngine.getHealthReport();
        
        // Log degradation
        if (health.overallStatus === 'DEGRADED') {
          logger.warn({ score: health.overallScore }, 'System health degraded');
        }
        
        if (health.overallStatus === 'CRITICAL') {
          logger.fatal({ score: health.overallScore }, '🚨 SYSTEM HEALTH CRITICAL');
        }

        // Self-healing is automatic via its own monitoring
        
      } catch (error) {
        logger.error({ error }, 'Monitor loop error');
      }
    }, intervalMs);
  }

  /**
   * STOP RUNTIME MONITORING
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('Runtime monitoring stopped');
    }
  }

  /**
   * GATE CHECK - Should system start?
   */
  async shouldStart(): Promise<{ start: boolean; fatal: boolean; report: SystemOrchestratorReport }> {
    const report = await this.runValidation();

    if (report.status === 'FAILED') {
      return { start: false, fatal: true, report };
    }

    if (report.status === 'DEGRADED') {
      return { start: true, fatal: false, report };
    }

    return { start: true, fatal: false, report };
  }
}

// Global instance
export const systemOrchestrator = new SystemOrchestrator();

export { SystemOrchestrator };
export default systemOrchestrator;
