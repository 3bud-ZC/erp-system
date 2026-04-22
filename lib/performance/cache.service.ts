/**
 * Caching Service - Production-Grade
 * In-memory cache with TTL support
 * In production, replace with Redis or similar distributed cache
 */

// ============================================================================
// CACHE ENTRY
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete multiple keys by pattern
   */
  deletePattern(pattern: string): number {
    let deleted = 0;
    const regex = new RegExp(pattern);

    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache by tenant
   */
  clearTenant(tenantId: string): number {
    return this.deletePattern(`^tenant:${tenantId}:`);
  }

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
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

export const cacheService = new CacheService();

// ============================================================================
// CACHE KEY HELPERS
// ============================================================================

export const CacheKeys = {
  // Account balances
  accountBalance: (tenantId: string, accountCode: string) =>
    `tenant:${tenantId}:account:${accountCode}:balance`,

  // Trial balance
  trialBalance: (tenantId: string, fiscalYearId?: string) =>
    `tenant:${tenantId}:trial-balance:${fiscalYearId || 'current'}`,

  // Stock levels
  stockLevel: (tenantId: string, productId: string) =>
    `tenant:${tenantId}:stock:${productId}`,

  // Customer credit
  customerCredit: (tenantId: string, customerId: string) =>
    `tenant:${tenantId}:customer:${customerId}:credit`,

  // User permissions
  userPermissions: (tenantId: string, userId: string) =>
    `tenant:${tenantId}:user:${userId}:permissions`,

  // User roles
  userRoles: (tenantId: string, userId: string) =>
    `tenant:${tenantId}:user:${userId}:roles`,
};
