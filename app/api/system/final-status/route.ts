/**
 * SYSTEM FINAL STATUS API
 * 
 * Returns complete orchestrated system state
 * GET /api/system/final-status
 */

import { systemOrchestrator, SystemOrchestratorReport } from '@/lib/system/orchestrator/system-orchestrator';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

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

    return apiSuccess(report);

  } catch (error: any) {
    logger.error({ error: error.message }, 'Final status endpoint error');
    return apiError(error.message || 'Final status failed', 500, { status: 'FAILED', timestamp: Date.now() });
  }
}

/**
 * POST to force re-validation
 */
export async function POST() {
  try {
    const report = await systemOrchestrator.runValidation();
    
    return apiSuccess(report, 'Fresh validation completed');

  } catch (error: any) {
    return apiError(error.message || 'Validation failed', 500, { status: 'FAILED' });
  }
}
