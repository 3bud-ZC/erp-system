/**
 * Rate Limiting Service - Production-Grade
 * Per-tenant rate limiting for API endpoints
 */

// ============================================================================
// IN-MEMORY RATE LIMITER (for development)
// In production, use Redis or similar distributed cache
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export class RateLimitService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request should be rate limited
   */
  checkRateLimit(
    tenantId: string,
    endpoint: string,
    limit: number = 100, // requests per window
    windowMs: number = 60000 // 1 minute window
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const key = `${tenantId}:${endpoint}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: entry.resetTime,
      };
    }

    // Check if limit exceeded
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(rateLimitStore.entries())) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Get rate limit info without incrementing
   */
  getRateLimitInfo(
    tenantId: string,
    endpoint: string
  ): { count: number; resetTime: number } | null {
    const key = `${tenantId}:${endpoint}`;
    const entry = rateLimitStore.get(key);

    if (!entry) {
      return null;
    }

    return {
      count: entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a tenant (admin function)
   */
  resetRateLimit(tenantId: string, endpoint: string): void {
    const key = `${tenantId}:${endpoint}`;
    rateLimitStore.delete(key);
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const rateLimitService = new RateLimitService();
