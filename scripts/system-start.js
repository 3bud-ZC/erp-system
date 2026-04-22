#!/usr/bin/env node
/**
 * SYSTEM STARTUP SCRIPT
 * 
 * Production-safe startup sequence:
 * 1. Run orchestrator validation
 * 2. Print system report
 * 3. Decide: FAIL → exit, DEGRADED → continue with warning, READY → continue
 * 4. Start Next.js server
 * 5. Start monitoring loop
 */

const { systemOrchestrator } = require('../lib/system/orchestrator/system-orchestrator');
const { spawn } = require('child_process');
const path = require('path');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBox(title, lines) {
  const width = Math.max(title.length, ...lines.map(l => l.length)) + 4;
  const border = '═'.repeat(width);
  
  console.log();
  log(`╔${border}╗`, 'cyan');
  log(`║${' '.repeat(Math.floor((width - title.length) / 2))}${title}${' '.repeat(Math.ceil((width - title.length) / 2))}║`, 'cyan');
  log(`╠${border}╣`, 'cyan');
  lines.forEach(line => {
    const padding = ' '.repeat(width - line.length - 2);
    log(`║  ${line}${padding}║`, 'cyan');
  });
  log(`╚${border}╝`, 'cyan');
  console.log();
}

async function main() {
  log('═══════════════════════════════════════════════════════', 'cyan');
  log('      ERP SYSTEM - PRODUCTION STARTUP SEQUENCE         ', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  console.log();

  try {
    // STEP 1: RUN ORCHESTRATOR VALIDATION
    log('[1/4] Running System Orchestrator Validation...', 'bright');
    const { start, fatal, report } = await systemOrchestrator.shouldStart();

    // STEP 2: PRINT SYSTEM REPORT
    log('[2/4] Generating System Report...', 'bright');
    printSystemReport(report);

    // STEP 3: MAKE DECISION
    log('[3/4] Making Startup Decision...', 'bright');
    
    if (!start && fatal) {
      // SYSTEM BLOCKED - EXIT
      logBox('❌ SYSTEM STARTUP BLOCKED', [
        `Status: ${report.status}`,
        `Health Score: ${report.healthScore}/100`,
        '',
        'Critical failures detected.',
        'System will NOT start.',
        '',
        'Check logs for details.',
      ]);
      
      process.exit(1);
    }

    if (report.status === 'DEGRADED') {
      // START WITH WARNINGS
      logBox('⚠️  SYSTEM STARTING IN DEGRADED MODE', [
        `Status: ${report.status}`,
        `Health Score: ${report.healthScore}/100`,
        '',
        'System will start but may',
        'have reduced performance.',
        '',
        'Review warnings below.',
      ]);

      if (report.warnings.length > 0) {
        log('WARNINGS:', 'yellow');
        report.warnings.forEach(w => log(`  ⚠ ${w}`, 'yellow'));
      }
    } else {
      // READY - START NORMALLY
      logBox('✅ SYSTEM READY', [
        `Status: ${report.status}`,
        `Health Score: ${report.healthScore}/100`,
        `Boot: ${report.boot.success ? 'OK' : 'FAILED'}`,
        `Smoke Tests: ${report.smokeTest.passedCount}/${report.smokeTest.total}`,
        '',
        'Starting Next.js server...',
      ]);
    }

    // STEP 4: START MONITORING
    log('[4/4] Starting Runtime Monitoring...', 'bright');
    systemOrchestrator.startMonitoring(30000); // Every 30 seconds
    log('✔ Monitoring started (30s interval)', 'green');

    // STEP 5: START NEXT.JS SERVER
    console.log();
    log('═══════════════════════════════════════════════════════', 'cyan');
    log('           STARTING NEXT.JS SERVER                       ', 'cyan');
    log('═══════════════════════════════════════════════════════', 'cyan');
    console.log();

    startNextServer();

  } catch (error) {
    logBox('❌ STARTUP ERROR', [
      'System orchestrator failed:',
      error.message,
      '',
      'System will NOT start.',
    ]);
    
    process.exit(1);
  }
}

function printSystemReport(report) {
  const statusColor = report.status === 'READY' ? 'green' : 
                      report.status === 'DEGRADED' ? 'yellow' : 'red';

  console.log();
  log(`  System Status: ${report.status}`, statusColor);
  log(`  Health Score:  ${report.healthScore}/100`, 'bright');
  log(`  Boot Success:  ${report.boot.success ? '✔' : '✗'}`, report.boot.success ? 'green' : 'red');
  log(`  Smoke Tests:   ${report.smokeTest.passedCount}/${report.smokeTest.total} passed`, 'bright');
  
  if (report.stressTest.run) {
    log(`  Stress Test:   ${report.stressTest.passed ? '✔ PASS' : '✗ FAIL'} ` +
        `(${report.stressTest.successRate.toFixed(1)}%)`, 
        report.stressTest.passed ? 'green' : 'yellow');
  }

  log(`  Circuit Breakers: ${report.circuitBreakers.open} open, ${report.circuitBreakers.closed} closed`, 'bright');
  log(`  Cache Mode:   ${report.cache.mode}`, 'bright');
  console.log();
}

function startNextServer() {
  const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
  
  const child = spawn('node', [nextBin, 'start'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });

  child.on('error', (err) => {
    log(`❌ Failed to start Next.js: ${err.message}`, 'red');
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      log(`❌ Next.js exited with code ${code}`, 'red');
    }
    process.exit(code || 0);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('Received SIGTERM, shutting down gracefully...', 'yellow');
    child.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    log('Received SIGINT, shutting down gracefully...', 'yellow');
    child.kill('SIGINT');
  });
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  log(`❌ Uncaught exception: ${err.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`❌ Unhandled rejection: ${reason}`, 'red');
  process.exit(1);
});

// Run main
main();
