/**
 * CACHING LAYER
 * Simple in-memory cache with TTL and logging
 * Can be upgraded to Redis for production scale
 */

import { logger } from './logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0,
    };
    this.store.set(key, entry);
    logger.debug({ key, ttl: entry.ttl }, 'Cache set');
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      logger.debug({ key }, 'Cache miss');
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      logger.debug({ key, age: Date.now() - entry.timestamp }, 'Cache expired');
      return null;
    }

    // Track hit
    entry.hits++;
    logger.debug({ key, hits: entry.hits }, 'Cache hit');
    return entry.data;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.store.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      logger.debug({ key, source: 'cache' }, 'Cache getOrSet - cache hit');
      return cached;
    }

    const fetchStart = Date.now();
    const data = await fetcher();
    const fetchDuration = Date.now() - fetchStart;
    
    this.set(key, data, ttl);
    logger.info({ key, fetchDuration, source: 'database' }, 'Cache getOrSet - fetched and cached');
    return data;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    totalHits: number;
    oldestEntry: number;
  } {
    let totalHits = 0;
    let oldestTimestamp = Date.now();

    this.store.forEach(entry => {
      totalHits += entry.hits;
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    });

    return {
      size: this.store.size,
      totalHits,
      oldestEntry: Date.now() - oldestTimestamp,
    };
  }
}

// Create cache instances for different use cases
export const dashboardCache = new Cache<any>();
export const reportCache = new Cache<any>();
export const inventoryCache = new Cache<any>();
export const kpiCache = new Cache<any>();

// Cleanup expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    dashboardCache.cleanup();
    reportCache.cleanup();
    inventoryCache.cleanup();
    kpiCache.cleanup();
  }, 60 * 1000); // Every minute
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  // Dashboard & Reports
  dashboardKPIs: (tenantId: string, period: string) => 
    `dashboard:kpi:${tenantId}:${period}`,
  
  salesReport: (tenantId: string, startDate: string, endDate: string) =>
    `report:sales:${tenantId}:${startDate}:${endDate}`,
  
  inventoryValuation: (tenantId: string, warehouseId?: string) =>
    `inventory:valuation:${tenantId}${warehouseId ? `:${warehouseId}` : ''}`,
  
  lowStockAlerts: (tenantId: string) =>
    `inventory:low-stock:${tenantId}`,
  
  agingReport: (tenantId: string, asOfDate: string) =>
    `report:aging:${tenantId}:${asOfDate}`,
  
  // Product cache
  productList: (tenantId: string, page: number, limit: number) =>
    `products:list:${tenantId}:${page}:${limit}`,
  
  productById: (tenantId: string, productId: string) =>
    `products:${tenantId}:${productId}`,
  
  productStock: (tenantId: string, productId: string) =>
    `products:stock:${tenantId}:${productId}`,
  
  // Customer cache
  customerList: (tenantId: string, page: number, limit: number) =>
    `customers:list:${tenantId}:${page}:${limit}`,
  
  customerById: (tenantId: string, customerId: string) =>
    `customers:${tenantId}:${customerId}`,
  
  // Supplier cache
  supplierList: (tenantId: string, page: number, limit: number) =>
    `suppliers:list:${tenantId}:${page}:${limit}`,
  
  supplierById: (tenantId: string, supplierId: string) =>
    `suppliers:${tenantId}:${supplierId}`,
  
  // Invoice cache (shorter TTL)
  salesInvoiceList: (tenantId: string, page: number, limit: number, status?: string) =>
    `invoices:sales:${tenantId}:${page}:${limit}${status ? `:${status}` : ''}`,
  
  purchaseInvoiceList: (tenantId: string, page: number, limit: number, status?: string) =>
    `invoices:purchase:${tenantId}:${page}:${limit}${status ? `:${status}` : ''}`,
};

/**
 * Invalidate cache for a tenant
 */
export function invalidateTenantCache(tenantId: string): void {
  const prefix = tenantId;
  
  const invalidateCache = (cache: Cache<any>) => {
    const keysToDelete: string[] = [];
    cache['store'].forEach((_: any, key: string) => {
      if (key.includes(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => cache.delete(key));
  };

  invalidateCache(dashboardCache);
  invalidateCache(reportCache);
  invalidateCache(inventoryCache);
  invalidateCache(kpiCache);
}
