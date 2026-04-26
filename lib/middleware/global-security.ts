/**
 * GLOBAL SECURITY MIDDLEWARE - FINAL PRODUCTION SHIELD
 * 
 * Enforces:
 * - System state validation for ALL requests
 * - Rate limiting with strict tiers
 * - Security headers
 * - Safe mode on critical failures
 * - Audit trail enforcement
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSystemState, SystemState } from '@/lib/system-state';
import { logger } from '@/lib/logger';

// ============================================================================
// RATE LIMITING STORE (in-memory with TTL)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  });
}, 60000); // Every minute

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

const RATE_LIMITS = {
  // Auth endpoints: 5 per 15 minutes
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  },
  // Init endpoint: 3 per hour
  init: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
  },
  // General API: 100 per minute
  general: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
};

// ============================================================================
// SAFE MODE DETECTION
// ============================================================================

let safeModeActive = false;
let safeModeReason: string | null = null;

export function activateSafeMode(reason: string): void {
  safeModeActive = true;
  safeModeReason = reason;
  logger.fatal({ reason }, '🔒 SAFE MODE ACTIVATED - System locked down');
}

export function isSafeModeActive(): boolean {
  // Re-check critical conditions
  if (!safeModeActive) {
    const jwtSecret = process.env.JWT_SECRET;
    const setupToken = process.env.SETUP_TOKEN;
    
    if (!jwtSecret || jwtSecret.length < 32) {
      activateSafeMode('MISSING_JWT_SECRET');
    } else if (!setupToken && process.env.NODE_ENV === 'production') {
      activateSafeMode('MISSING_SETUP_TOKEN');
    }
  }
  
  return safeModeActive;
}

// Initial check on load
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  activateSafeMode('MISSING_JWT_SECRET');
}

// ============================================================================
// RATE LIMIT CHECK
// ============================================================================

function checkRateLimit(
  identifier: string,
  tier: 'auth' | 'init' | 'general'
): { allowed: boolean; retryAfter?: number; remaining?: number } {
  // E2E bypass: when the runner sets E2E_BYPASS_RATE_LIMIT=1 we short-circuit
  // the check. Default behavior (rate-limiting fully enforced) is unchanged
  // because the env var is not set in any production deployment.
  if (process.env.E2E_BYPASS_RATE_LIMIT === '1') {
    return { allowed: true, remaining: 999 };
  }

  const now = Date.now();
  const config = RATE_LIMITS[tier];
  const key = `${tier}:${identifier}`;
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
      windowMs: config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      remaining: 0,
    };
  }
  
  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count };
}

function getClientIdentifier(request: NextRequest): string {
  // Get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // Add user agent fingerprint for additional uniqueness
  const ua = request.headers.get('user-agent') || '';
  const uaHash = ua.slice(0, 50); // First 50 chars of UA
  
  return `${ip}:${uaHash}`;
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// HSTS only in production
if (process.env.NODE_ENV === 'production') {
  (SECURITY_HEADERS as any)['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
}

// ============================================================================
// MAIN SECURITY MIDDLEWARE
// ============================================================================

export async function globalSecurityMiddleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const path = request.nextUrl.pathname;
  const startTime = Date.now();
  
  // Create response with security headers
  const response = NextResponse.next();
  
  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Add request ID header for tracing
  response.headers.set('X-Request-ID', requestId);
  
  // ==========================================================================
  // 1. SAFE MODE CHECK (HIGHEST PRIORITY)
  // ==========================================================================
  
  if (isSafeModeActive()) {
    // Only allow health checks in safe mode
    if (!path.startsWith('/api/health')) {
      logger.error({ requestId, path, reason: safeModeReason }, 'Request blocked - SAFE MODE');
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SYSTEM_IN_SAFE_MODE',
            message: 'System is in safe mode due to critical configuration error. Contact administrator immediately.',
            reason: safeModeReason,
          },
        },
        { 
          status: 503,
          headers: response.headers,
        }
      );
    }
  }
  
  // ==========================================================================
  // 2. RATE LIMITING
  // ==========================================================================
  
  const clientId = getClientIdentifier(request);
  let rateLimitTier: 'auth' | 'init' | 'general' = 'general';
  
  if (path.startsWith('/api/auth/')) {
    rateLimitTier = 'auth';
  } else if (path.startsWith('/api/init')) {
    rateLimitTier = 'init';
  }
  
  const rateLimitResult = checkRateLimit(clientId, rateLimitTier);
  
  // Add rate limit headers
  if (rateLimitResult.remaining !== undefined) {
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  }
  
  if (!rateLimitResult.allowed) {
    logger.warn({ 
      requestId, 
      path, 
      clientId,
      tier: rateLimitTier,
      retryAfter: rateLimitResult.retryAfter 
    }, 'Rate limit exceeded');
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for ${rateLimitTier} endpoints. Please try again later.`,
          retryAfter: rateLimitResult.retryAfter,
        },
      },
      { 
        status: 429,
        headers: {
          ...Object.fromEntries(response.headers),
          'Retry-After': String(rateLimitResult.retryAfter || 60),
        },
      }
    );
  }
  
  // ==========================================================================
  // 3. SYSTEM STATE ENFORCEMENT
  // ==========================================================================
  
  // Always allow these paths regardless of system state
  const alwaysAllowedPaths = [
    '/api/health',
    '/api/init',
    '/api/system/status',
    '/_next',
    '/static',
    '/favicon.ico',
  ];
  
  const isAlwaysAllowed = alwaysAllowedPaths.some(p => 
    path.startsWith(p) || path === p
  );
  
  if (!isAlwaysAllowed) {
    const { state, blocked } = await getSystemState();
    
    if (blocked) {
      logger.warn({ 
        requestId, 
        path, 
        state,
        clientId 
      }, 'Request blocked - system not initialized');
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SYSTEM_NOT_READY',
            message: 'System is not initialized. Contact administrator.',
            state,
          },
        },
        { 
          status: 503,
          headers: response.headers,
        }
      );
    }
    
    // Log successful state check
    logger.debug({ requestId, path, state }, 'System state check passed');
  }
  
  // ==========================================================================
  // 4. PRODUCTION INIT DISABLEMENT
  // ==========================================================================
  
  if (process.env.NODE_ENV === 'production' && path.startsWith('/api/init')) {
    // Check if system is already initialized
    const { state } = await getSystemState();
    
    if (state === 'LOCKED' || state === 'INITIALIZED') {
      logger.warn({ requestId, path, state }, 'Init endpoint blocked in production');
      
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ENDPOINT_DEPRECATED',
            message: '/api/init is disabled in production. System already initialized.',
          },
        },
        { 
          status: 410, // Gone
          headers: response.headers,
        }
      );
    }
  }
  
  // Log request timing
  const duration = Date.now() - startTime;
  logger.debug({ requestId, path, duration }, 'Security middleware passed');
  
  // Store requestId in headers for downstream use
  response.headers.set('X-Request-ID', requestId);
  
  return response;
}

// ============================================================================
// AUDIT TRAIL MIDDLEWARE
// ============================================================================

export async function auditMiddleware(request: NextRequest) {
  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();
  const path = request.nextUrl.pathname;
  const method = request.method;
  
  // Only audit mutation methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return NextResponse.next();
  }
  
  // Skip audit for certain paths
  const skipAuditPaths = ['/api/health', '/api/auth/login', '/api/init'];
  if (skipAuditPaths.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }
  
  const startTime = Date.now();
  
  // Store audit context for later
  (request as any).auditContext = {
    requestId,
    path,
    method,
    startTime,
    timestamp: new Date(),
  };
  
  logger.info({
    requestId,
    path,
    method,
    type: 'mutation_start',
  }, 'Audit: Mutation started');
  
  return NextResponse.next();
}

// ============================================================================
// EXPORTS
// ============================================================================

export { rateLimitStore, RATE_LIMITS };
export default globalSecurityMiddleware;
