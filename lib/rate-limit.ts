/**
 * Rate limiting middleware for API protection
 * Uses in-memory storage (can be upgraded to Redis for production)
 */

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitStore>();

/**
 * Rate limit configuration per endpoint
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const defaultRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
};

const strictRateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes (for sensitive endpoints)
};

/**
 * Get rate limit configuration based on endpoint
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  // Strict rate limiting for authentication endpoints
  if (endpoint.includes('/login') || endpoint.includes('/register')) {
    return strictRateLimitConfig;
  }
  
  // Strict rate limiting for critical operations
  if (endpoint.includes('/delete') || endpoint.includes('/transfer')) {
    return strictRateLimitConfig;
  }
  
  return defaultRateLimitConfig;
}

/**
 * Check if rate limit is exceeded
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = defaultRateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // Clean up expired records
  if (record && record.resetTime < now) {
    rateLimitStore.delete(identifier);
  }

  const currentRecord = rateLimitStore.get(identifier);

  if (!currentRecord) {
    // First request in window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  if (currentRecord.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: currentRecord.resetTime,
    };
  }

  // Increment count
  currentRecord.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - currentRecord.count,
    resetTime: currentRecord.resetTime,
  };
}

/**
 * Generate rate limit identifier from request
 */
export function getRateLimitIdentifier(request: Request): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const userId = request.headers.get('x-user-id');
  
  // Use user ID if available, otherwise use IP
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Rate limit middleware for Next.js API routes
 */
export async function rateLimitMiddleware(
  request: Request,
  config?: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const identifier = getRateLimitIdentifier(request);
  const endpointConfig = config || getRateLimitConfig(request.url);
  
  return checkRateLimit(identifier, endpointConfig);
}

/**
 * Clean up expired rate limit records (call periodically)
 */
export function cleanupRateLimitRecords() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((record, key) => {
    if (record.resetTime < now) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

// Cleanup expired records every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitRecords, 5 * 60 * 1000);
}
