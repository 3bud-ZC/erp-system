/**
 * FINAL PRODUCTION SHIELD MIDDLEWARE
 * 
 * Enforces:
 * 1. Safe mode on critical failures
 * 2. System state validation
 * 3. Rate limiting (auth/init/general)
 * 4. Production init disablement
 * 5. Security headers
 * 6. JWT validation
 * 7. Audit trail hooks
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// SAFE MODE DETECTION (CRITICAL)
// ============================================================================

let safeModeActive = false;
let safeModeReason: string | null = null;

function activateSafeMode(reason: string): void {
  safeModeActive = true;
  safeModeReason = reason;
  console.error(`[FATAL] SAFE MODE ACTIVATED: ${reason}`);
}

function isSafeModeActive(): boolean {
  if (!safeModeActive) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      activateSafeMode('MISSING_JWT_SECRET');
    }
  }
  return safeModeActive;
}

// Initial check
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  activateSafeMode('MISSING_JWT_SECRET');
}

// ============================================================================
// RATE LIMITING (IN-MEMORY)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMITS = {
  auth: { windowMs: 15 * 60 * 1000, maxRequests: 5 },      // 5 per 15 min
  init: { windowMs: 60 * 60 * 1000, maxRequests: 3 },      // 3 per hour
  general: { windowMs: 60 * 1000, maxRequests: 100 },      // 100 per min
};

function checkRateLimit(identifier: string, tier: 'auth' | 'init' | 'general') {
  // E2E bypass: when E2E_BYPASS_RATE_LIMIT=1 is set on the server process we
  // short-circuit the check. Default behavior unchanged in production
  // because the env var is not set in any deployment. See also the matching
  // bypasses in lib/middleware/global-security.ts and lib/rate-limit.ts.
  if (process.env.E2E_BYPASS_RATE_LIMIT === '1') {
    return { allowed: true, remaining: 999 };
  }

  const now = Date.now();
  const config = RATE_LIMITS[tier];
  const key = `${tier}:${identifier}`;
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1 };
  }
  
  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count };
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] || 'unknown';
  const ua = request.headers.get('user-agent') || '';
  return `${ip}:${ua.slice(0, 20)}`;
}

// Cleanup every minute
setInterval(() => {
  const now = Date.now();
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  });
}, 60000);

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

if (process.env.NODE_ENV === 'production') {
  (SECURITY_HEADERS as Record<string, string>)['Strict-Transport-Security'] = 
    'max-age=31536000; includeSubDomains; preload';
}

// ============================================================================
// JWT VALIDATION (EXISTING - PRESERVED)
// ============================================================================

function validateToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    for (const part of parts) {
      if (!/^[A-Za-z0-9_-]*$/.test(part)) return false;
    }
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (header.alg !== 'HS256') return false;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (!payload.userId) return false;
    
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * MAIN MIDDLEWARE - PRODUCTION SHIELD
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();
  
  // Create response with security headers
  const response = NextResponse.next();
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set('X-Request-ID', requestId);
  
  // ==========================================================================
  // 1. SAFE MODE CHECK (HIGHEST PRIORITY)
  // ==========================================================================
  
  if (isSafeModeActive() && !pathname.startsWith('/api/health')) {
    console.error(`[${requestId}] BLOCKED: Safe mode active (${safeModeReason})`);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYSTEM_IN_SAFE_MODE',
          message: 'System is in safe mode due to critical configuration error.',
          reason: safeModeReason,
        },
      },
      { status: 503 }
    );
  }
  
  // ==========================================================================
  // 2. RATE LIMITING
  // ==========================================================================
  
  const clientId = getClientId(request);
  let tier: 'auth' | 'init' | 'general' = 'general';
  
  if (pathname.startsWith('/api/auth/')) tier = 'auth';
  else if (pathname.startsWith('/api/init')) tier = 'init';
  
  const rateLimit = checkRateLimit(clientId, tier);
  
  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded: ${tier}`);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for ${tier} endpoints.`,
          retryAfter: rateLimit.retryAfter,
        },
      },
      { 
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfter || 60) }
      }
    );
  }
  
  // ==========================================================================
  // 3. PRODUCTION INIT DISABLEMENT
  // ==========================================================================
  
  if (process.env.NODE_ENV === 'production' && pathname.startsWith('/api/init')) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ENDPOINT_DEPRECATED',
          message: '/api/init is disabled in production.',
        },
      },
      { status: 410 }
    );
  }
  
  // ==========================================================================
  // 4. PUBLIC ROUTES (skip auth check)
  // ==========================================================================
  
  const publicRoutes = [
    '/login',
    '/onboarding',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/onboarding/init',
    '/setup',
    '/api/init',
    '/api/health',
  ];
  
  if (publicRoutes.some((route: string) => pathname.startsWith(route))) {
    return response;
  }
  
  // ==========================================================================
  // 5. JWT VALIDATION
  // ==========================================================================
  
  const token = request.cookies.get('token')?.value;
  
  // For API routes
  if (pathname.startsWith('/api/')) {
    if (!token || !validateToken(token)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    return response;
  }
  
  // For page routes
  if (!token || !validateToken(token)) {
    if (pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
