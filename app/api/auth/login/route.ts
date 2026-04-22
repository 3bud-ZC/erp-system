/**
 * PRODUCTION LOGIN ENDPOINT
 * 
 * Security features:
 * - NO auto-bootstrap (explicit init only)
 * - NO hardcoded credentials
 * - Rate limiting
 * - Structured logging
 * - System state validation
 */

import { apiSuccess, apiError } from '@/lib/api-response';
import { loginUser, logAuditAction } from '@/lib/auth';
import { checkRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit';
import { getSystemState } from '@/lib/system-state';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// Strict rate limit: 5 attempts per 15 minutes per IP
const loginRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts
};

/**
 * POST /api/auth/login
 * Production login - NO auto-bootstrap
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Check system state first - NO MODIFICATIONS ALLOWED
    const { state, blocked } = await getSystemState();
    
    if (blocked) {
      logger.warn({ 
        requestId, 
        path: request.url,
        state 
      }, 'Blocked login - system not initialized');
      
      return apiError(
        'System is not initialized. Contact administrator.',
        503,
        { 
          code: 'SYSTEM_NOT_READY',
          state 
        }
      );
    }

    // Check rate limit
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = checkRateLimit(`login:${identifier}`, loginRateLimit);
    
    if (!rateLimitResult.allowed) {
      logger.warn({ 
        requestId, 
        identifier,
        retryAfter: rateLimitResult.resetTime 
      }, 'Rate limit exceeded');
      
      return apiError(
        'Too many login attempts. Please try again later.',
        429,
        { 
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          remaining: 0 
        }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      logger.warn({ requestId }, 'Missing credentials');
      return apiError('البريد الإلكتروني وكلمة المرور مطلوبان', 400);
    }

    // PRODUCTION: Direct login - NO bootstrap, NO auto-create
    const result = await loginUser(email, password);
    
    const duration = Date.now() - startTime;
    
    logger.info({
      requestId,
      userId: result.id,
      email: result.email,
      duration,
      state,
    }, 'Login successful');

    // Log audit action
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logAuditAction(
      result.id,
      'LOGIN',
      'auth',
      'User',
      undefined,
      undefined,
      ipAddress,
      userAgent
    );

    // Set secure HttpOnly cookie
    const cookieStore = cookies();
    cookieStore.set('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return user data without token
    const { token, password: _, ...userData } = result;
    return apiSuccess(userData, 'تم تسجيل الدخول بنجاح');
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error({
      requestId,
      error: error.message,
      duration,
    }, 'Login failed');
    
    return apiError(
      error.message || 'فشل تسجيل الدخول',
      401
    );
  }
}
