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

import { NextResponse } from 'next/server';
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

    return NextResponse.json({
      success: true,
      state,
      blocked,
      initialized: settings?.initialized || false,
      locked: settings?.locked || false,
      productionMode: settings?.productionMode || false,
      message: blocked 
        ? 'System not initialized' 
        : 'System ready',
    });

  } catch (error: any) {
    logger.error({ error: error.message }, 'Status check failed');
    return NextResponse.json({
      success: false,
      message: 'Failed to check system status',
    }, { status: 500 });
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
      return NextResponse.json({
        success: false,
        message: 'System not configured for initialization',
      }, { status: 500 });
    }
    
    if (authHeader !== `Bearer ${setupToken}`) {
      logger.warn({ requestId }, 'Unauthorized initialization attempt');
      return NextResponse.json({
        success: false,
        message: 'Unauthorized',
      }, { status: 401 });
    }

    // Check if seeding is allowed
    const { allowed, reason } = await isSeedingAllowed();
    
    if (!allowed) {
      logger.warn({ requestId, reason }, 'Seeding not allowed');
      return NextResponse.json({
        success: false,
        message: reason || 'Seeding not allowed',
      }, { status: 403 });
    }

    // Acquire lock (prevents concurrent initialization)
    const { acquired, lockId, error: lockError } = await acquireInitLock();
    
    if (!acquired || !lockId) {
      logger.warn({ requestId, lockError }, 'Failed to acquire init lock');
      return NextResponse.json({
        success: false,
        message: lockError || 'Initialization in progress or system already initialized',
      }, { status: 423 });
    }

    logger.info({ requestId, lockId }, 'Lock acquired, starting initialization');

    try {
      // Run bootstrap
      const result = await bootstrapSystem();

      if (!result.success) {
        logger.error({ requestId, errors: result.errors }, 'Bootstrap failed');
        return NextResponse.json({
          success: false,
          message: 'System initialization failed',
          errors: result.errors,
        }, { status: 500 });
      }

      // Mark system as initialized
      const marked = await markInitialized(lockId);
      
      if (!marked) {
        logger.error({ requestId }, 'Failed to mark system initialized');
        return NextResponse.json({
          success: false,
          message: 'Failed to finalize initialization',
        }, { status: 500 });
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

      return NextResponse.json({
        success: true,
        message: 'System initialized successfully',
        state: process.env.NODE_ENV === 'production' ? 'LOCKED' : 'INITIALIZED',
        locked: process.env.NODE_ENV === 'production',
        created: result.created,
        warning: process.env.NODE_ENV === 'production' 
          ? '🔒 PRODUCTION MODE: System locked. Change default credentials immediately!' 
          : undefined,
      });

    } finally {
      // Always release lock
      if (lockId) {
        await releaseInitLock(lockId);
      }
    }

  } catch (error: any) {
    logger.error({ requestId, error: error.message }, 'Initialization error');
    return NextResponse.json({
      success: false,
      message: 'Initialization failed',
    }, { status: 500 });
  }
}
