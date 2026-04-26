/**
 * SYSTEM STATUS ENDPOINT
 * Read-only status check for monitoring and diagnostics
 */

import { getSystemState } from '@/lib/system-state';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { state, settings, blocked } = await getSystemState();
    
    // Safe mode check (don't expose critical details)
    const safeMode = !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32;
    
    logger.debug({ state, blocked }, 'System status requested');
    
    return apiSuccess({
      state,
      blocked,
      initialized: settings?.initialized || false,
      locked: settings?.locked || false,
      productionMode: settings?.productionMode || false,
      safeMode,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error: any) {
    logger.error({ error: error.message }, 'Status check failed');
    return apiError('Failed to retrieve system status', 500, { code: 'STATUS_CHECK_FAILED' });
  }
}
