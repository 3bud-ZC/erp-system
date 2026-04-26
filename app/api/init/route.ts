/**
 * PRODUCTION SYSTEM INITIALIZATION
 * 
 * Security controls:
 * - Requires SETUP_TOKEN for initialization (env var)
 * - Concurrency lock prevents parallel initialization
 * - NO auto-bootstrap on GET
 * - System state validation
 * - Idempotent with lock protection
 */

import { 
  getSystemState, 
  acquireInitLock, 
  releaseInitLock, 
  markInitialized,
  isSeedingAllowed,
  lockSystem
} from '@/lib/system-state';
import { bootstrapSystem } from '@/lib/system-bootstrap';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic';

/**
 * GET /api/init
 * Check system status ONLY - NO modification
 */
export async function GET() {
  try {
    const { state, settings, blocked } = await getSystemState();
    
    logger.info({ state, blocked }, 'System status check');

    return apiSuccess(
      {
        state,
        blocked,
        initialized: settings?.initialized || false,
        locked: settings?.locked || false,
        productionMode: settings?.productionMode || false,
      },
      blocked ? 'System not initialized' : 'System ready'
    );

  } catch (error: any) {
    logger.error({ error: error.message }, 'Status check failed');
    return apiError('Failed to check system status', 500);
  }
}

/**
 * POST /api/init
 * Initialize system with authorization token
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const setupToken = process.env.SETUP_TOKEN;
    
    if (!setupToken) {
      logger.error('SETUP_TOKEN not configured');
      return apiError('System not configured for initialization', 500);
    }
    
    if (authHeader !== `Bearer ${setupToken}`) {
      logger.warn({ requestId }, 'Unauthorized initialization attempt');
      return apiError('Unauthorized', 401);
    }

    // Check if seeding is allowed
    const { allowed, reason } = await isSeedingAllowed();
    
    if (!allowed) {
      logger.warn({ requestId, reason }, 'Seeding not allowed');
      return apiError(reason || 'Seeding not allowed', 403);
    }

    // Acquire lock (prevents concurrent initialization)
    const { acquired, lockId, error: lockError } = await acquireInitLock();
    
    if (!acquired || !lockId) {
      logger.warn({ requestId, lockError }, 'Failed to acquire init lock');
      return apiError(lockError || 'Initialization in progress or system already initialized', 423);
    }

    logger.info({ requestId, lockId }, 'Lock acquired, starting initialization');

    try {
      // Run bootstrap
      const result = await bootstrapSystem();

      if (!result.success) {
        logger.error({ requestId, errors: result.errors }, 'Bootstrap failed');
        return apiError('System initialization failed', 500, { errors: result.errors });
      }

      // Mark system as initialized
      const marked = await markInitialized(lockId);
      
      if (!marked) {
        logger.error({ requestId }, 'Failed to mark system initialized');
        return apiError('Failed to finalize initialization', 500);
      }

      // Lock system in production mode (IRREVERSIBLE)
      if (process.env.NODE_ENV === 'production') {
        await lockSystem();
        logger.warn({ requestId }, '🔒 PRODUCTION LOCK APPLIED - System locked');
      }

      logger.info({ 
        requestId, 
        created: result.created,
        state: process.env.NODE_ENV === 'production' ? 'LOCKED' : 'INITIALIZED',
        locked: process.env.NODE_ENV === 'production',
      }, '✅ System initialized successfully');

      return apiSuccess(
        {
          state: process.env.NODE_ENV === 'production' ? 'LOCKED' : 'INITIALIZED',
          locked: process.env.NODE_ENV === 'production',
          created: result.created,
          warning: process.env.NODE_ENV === 'production' 
            ? '🔒 PRODUCTION MODE: System locked. Change default credentials immediately!' 
            : undefined,
        },
        'System initialized successfully'
      );

    } finally {
      // Always release lock
      if (lockId) {
        await releaseInitLock(lockId);
      }
    }

  } catch (error: any) {
    logger.error({ requestId, error: error.message }, 'Initialization error');
    return apiError('Initialization failed', 500);
  }
}
