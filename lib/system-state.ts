/**
 * PRODUCTION SYSTEM STATE MANAGEMENT
 * 
 * States:
 * - UNINITIALIZED: System needs setup (block all except /health, /init)
 * - INITIALIZED: Normal operation
 * - LOCKED: Production mode (no seeding allowed)
 * 
 * Database flags:
 * - system_settings.initialized
 * - system_settings.locked
 * - system_settings.initLock (for concurrency control)
 */

import { prisma } from './db';
import { logger } from './logger';

export type SystemState = 'UNINITIALIZED' | 'INITIALIZED' | 'LOCKED';

export interface SystemSettings {
  id: string;
  initialized: boolean;
  locked: boolean;
  initLock: Date | null;
  initLockId: string | null;
  productionMode: boolean;
  lastUpdated: Date;
}

const INIT_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get or create system settings
 */
export async function getSystemSettings(): Promise<SystemSettings | null> {
  try {
    const settings = await (prisma as any).systemSettings.findFirst();
    
    if (!settings) {
      // Create default settings
      return await (prisma as any).systemSettings.create({
        data: {
          initialized: false,
          locked: false,
          initLock: null,
          initLockId: null,
          productionMode: process.env.NODE_ENV === 'production',
        },
      });
    }
    
    return settings;
  } catch (error) {
    logger.error({ error }, 'Failed to get system settings');
    return null;
  }
}

/**
 * Get current system state
 */
export async function getSystemState(): Promise<{
  state: SystemState;
  settings: SystemSettings | null;
  blocked: boolean;
}> {
  const settings = await getSystemSettings();
  
  if (!settings) {
    return { state: 'UNINITIALIZED', settings: null, blocked: true };
  }
  
  if (settings.locked) {
    return { state: 'LOCKED', settings, blocked: false };
  }
  
  if (settings.initialized) {
    return { state: 'INITIALIZED', settings, blocked: false };
  }
  
  return { state: 'UNINITIALIZED', settings, blocked: true };
}

/**
 * Check if request should be blocked due to uninitialized state
 */
export async function shouldBlockRequest(path: string): Promise<{
  blocked: boolean;
  reason?: string;
}> {
  // Always allow these paths
  const allowedPaths = [
    '/api/health',
    '/api/init',
    '/api/system/status',
    '/api/setup',
    '/_next',
    '/static',
  ];
  
  if (allowedPaths.some(p => path.startsWith(p))) {
    return { blocked: false };
  }
  
  const { state } = await getSystemState();
  
  if (state === 'UNINITIALIZED') {
    return {
      blocked: true,
      reason: 'System is not initialized. Contact administrator.',
    };
  }
  
  return { blocked: false };
}

/**
 * Acquire initialization lock (prevents concurrent initialization)
 */
export async function acquireInitLock(): Promise<{
  acquired: boolean;
  lockId?: string;
  error?: string;
}> {
  const lockId = `init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const settings = await getSystemSettings();
    
    if (!settings) {
      return { acquired: false, error: 'Cannot access system settings' };
    }
    
    // Check if already initialized
    if (settings.initialized || settings.locked) {
      return { acquired: false, error: 'System already initialized' };
    }
    
    // Check if lock is held and not expired
    if (settings.initLock && settings.initLockId) {
      const lockAge = Date.now() - new Date(settings.initLock).getTime();
      
      if (lockAge < INIT_LOCK_TIMEOUT_MS) {
        return { 
          acquired: false, 
          error: `Initialization in progress (lock held by ${settings.initLockId})` 
        };
      }
      
      // Lock expired, steal it
      logger.warn({ oldLockId: settings.initLockId }, 'Stealing expired init lock');
    }
    
    // Acquire lock
    await (prisma as any).systemSettings.update({
      where: { id: settings.id },
      data: {
        initLock: new Date(),
        initLockId: lockId,
      },
    });
    
    logger.info({ lockId }, 'Initialization lock acquired');
    return { acquired: true, lockId };
    
  } catch (error) {
    logger.error({ error }, 'Failed to acquire init lock');
    return { acquired: false, error: 'Failed to acquire lock' };
  }
}

/**
 * Release initialization lock
 */
export async function releaseInitLock(lockId: string): Promise<void> {
  try {
    const settings = await getSystemSettings();
    
    if (!settings || settings.initLockId !== lockId) {
      logger.warn({ lockId, currentLock: settings?.initLockId }, 'Cannot release lock - not owned');
      return;
    }
    
    await (prisma as any).systemSettings.update({
      where: { id: settings.id },
      data: {
        initLock: null,
        initLockId: null,
      },
    });
    
    logger.info({ lockId }, 'Initialization lock released');
  } catch (error) {
    logger.error({ error, lockId }, 'Failed to release init lock');
  }
}

/**
 * Mark system as initialized
 */
export async function markInitialized(lockId: string): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    
    if (!settings || settings.initLockId !== lockId) {
      logger.error('Invalid lock ID when marking initialized');
      return false;
    }
    
    await (prisma as any).systemSettings.update({
      where: { id: settings.id },
      data: {
        initialized: true,
        initLock: null,
        initLockId: null,
        lastUpdated: new Date(),
      },
    });
    
    logger.info('✅ System marked as INITIALIZED');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to mark system initialized');
    return false;
  }
}

/**
 * Lock system (production mode)
 */
export async function lockSystem(): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    
    if (!settings) return false;
    
    await (prisma as any).systemSettings.update({
      where: { id: settings.id },
      data: {
        locked: true,
        productionMode: true,
        lastUpdated: new Date(),
      },
    });
    
    logger.info('🔒 System LOCKED for production');
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to lock system');
    return false;
  }
}

/**
 * Check if seeding is allowed
 */
export async function isSeedingAllowed(): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const settings = await getSystemSettings();
  
  if (!settings) {
    return { allowed: true }; // First time
  }
  
  if (settings.locked) {
    return { allowed: false, reason: 'System is locked (production mode)' };
  }
  
  if (settings.initialized && process.env.NODE_ENV === 'production') {
    return { allowed: false, reason: 'System already initialized in production' };
  }
  
  return { allowed: true };
}

/**
 * Production middleware - blocks requests if system not ready
 */
export function createProductionMiddleware() {
  return async function productionMiddleware(request: Request): Promise<Response | null> {
    const path = new URL(request.url).pathname;
    
    // Skip check for allowed paths
    const skipPaths = ['/api/health', '/api/init', '/api/system/status', '/_next', '/static'];
    if (skipPaths.some(p => path.startsWith(p))) {
      return null; // Allow
    }
    
    const { blocked, reason } = await shouldBlockRequest(path);
    
    if (blocked) {
      logger.warn({ path }, 'Blocked request - system not initialized');
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'SYSTEM_NOT_READY',
            message: reason || 'System is not initialized. Contact administrator.',
          },
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return null; // Allow
  };
}
