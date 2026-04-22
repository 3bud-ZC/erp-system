/**
 * SYSTEM FINAL STATUS API
 * 
 * Returns complete orchestrated system state
 * GET /api/system/final-status
 */

import { NextResponse } from 'next/server';
import { systemOrchestrator, SystemOrchestratorReport } from '@/lib/system/orchestrator/system-orchestrator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get the last orchestrator report
    let report = systemOrchestrator.getLastReport();

    // If no report exists or it's stale (>5 min old), run validation
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (!report || (Date.now() - report.timestamp) > maxAge) {
      logger.info('Stale or missing report - running fresh validation');
      report = await systemOrchestrator.runValidation();
    }

    return NextResponse.json({
      success: true,
      ...report,
    });

  } catch (error: any) {
    logger.error({ error: error.message }, 'Final status endpoint error');
    
    return NextResponse.json(
      { 
        success: false,
        status: 'FAILED',
        error: error.message,
        timestamp: Date.now(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST to force re-validation
 */
export async function POST() {
  try {
    const report = await systemOrchestrator.runValidation();
    
    return NextResponse.json({
      success: true,
      message: 'Fresh validation completed',
      ...report,
    });

  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false,
        status: 'FAILED',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
