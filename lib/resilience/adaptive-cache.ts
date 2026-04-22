/**
 * SMART ADAPTIVE CACHE LAYER
 * 
 * Features:
 * - TTL-based caching with dynamic adjustment
 * - Cache modes: HOT (high traffic) / WARM (normal) / COLD (low traffic)
 * - Hit/miss tracking
 * - Automatic invalidation on mutations
 * - Memory pressure handling
 */

import { logger } from '@/lib/logger';

export type CacheMode = 'HOT' | 'WARM' | 'COLD';

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  tags: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  avgLatency: number;
  mode: CacheMode;
  memoryUsage: number;
}

interface AdaptiveCacheConfig {
  maxSize: number;              // Max entries
  maxMemory: number;            // Max memory in bytes (default 100MB)
  defaultTTL: number;           // Default TTL in ms
  hotTTL: number;               // TTL for HOT mode
  warmTTL: number;              // TTL for WARM mode
  coldTTL: number;              // TTL for COLD mode
  modeThresholdHot: number;     // Hit rate for HOT mode
  modeThresholdCold: number;    // Hit rate for COLD mode
  checkInterval: number;        // Mode adjustment interval
  evictionPolicy: 'lru' | 'lfu' | 'size';
}

const DEFAULT_CONFIG: AdaptiveCacheConfig = {
  maxSize: 10000,
  maxMemory: 100 * 1024 * 1024, // 100MB
  defaultTTL: 5 * 60 * 1000,     // 5 minutes
  hotTTL: 15 * 60 * 1000,        // 15 minutes (hot items stay longer)
  warmTTL: 5 * 60 * 1000,        // 5 minutes
  coldTTL: 60 * 1000,            // 1 minute (cold items expire fast)
  modeThresholdHot: 0.8,         // 80% hit rate = HOT
  modeThresholdCold: 0.3,        // 30% hit rate = COLD
  checkInterval: 30 * 1000,      // 30 seconds
  evictionPolicy: 'lru',
};

class AdaptiveCache {
  private name: string;
  private cache = new Map<string, CacheEntry<any>>();
  private config: AdaptiveCacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalLatency: 0,
    requestCount: 0,
  };
  private mode: CacheMode = 'WARM';
  private modeHistory: Array<{ timestamp: number; mode: CacheMode; hitRate: number }> = [];
  private invalidationHandlers = new Map<string, Set<() => void>>();

  constructor(name: string, config: Partial<AdaptiveCacheConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.startAdaptiveModeManagement();
    this.startMemoryPressureMonitoring();
    
    logger.info({ cache: name, config: this.config }, 'Adaptive cache initialized');
  }

  /**
   * Get value from cache or compute it
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: {
      ttl?: number;
      tags?: string[];
      staleWhileRevalidate?: boolean;
    } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    // Check if entry exists and is valid
    if (entry) {
      const now = Date.now();
      
      if (now < entry.expiresAt) {
        // Cache hit - valid entry
        this.onHit(entry, startTime);
        return entry.value;
      }

      if (options.staleWhileRevalidate && now < entry.expiresAt + 60000) {
        // Serve stale while revalidating in background
        this.onHit(entry, startTime);
        
        // Background revalidation
        this.backgroundRevalidate(key, factory, options);
        
        return entry.value;
      }
    }

    // Cache miss - compute value
    this.onMiss(startTime);
    
    try {
      const value = await factory();
      this.set(key, value, options);
      return value;
    } catch (error) {
      // If stale data available, serve it on error
      if (entry && options.staleWhileRevalidate) {
        logger.warn({ cache: this.name, key }, 'Serving stale data due to factory error');
        return entry.value;
      }
      throw error;
    }
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, options: {
    ttl?: number;
    tags?: string[];
  } = {}): void {
    // Calculate TTL based on current mode
    const ttl = options.ttl || this.getTTLForMode();
    
    // Estimate size (rough approximation)
    const size = this.estimateSize(value);

    // Check memory pressure before adding
    if (this.shouldEvict(size)) {
      this.evictForSize(size);
    }

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      tags: options.tags || [],
    };

    this.cache.set(key, entry);

    logger.debug({
      cache: this.name,
      key,
      ttl,
      mode: this.mode,
      size,
    }, 'Cache entry set');
  }

  /**
   * Get value from cache (no factory)
   */
  get<T>(key: string): T | undefined {
    const startTime = Date.now();
    const entry = this.cache.get(key);

    if (!entry) {
      this.onMiss(startTime);
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.onMiss(startTime);
      return undefined;
    }

    this.onHit(entry, startTime);
    return entry.value;
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) {
      logger.debug({ cache: this.name, key }, 'Cache entry deleted');
    }
    return existed;
  }

  /**
   * Invalidate by tag
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }

    // Trigger invalidation handlers
    const handlers = this.invalidationHandlers.get(tag);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler();
        } catch (error) {
          logger.error({ error, tag }, 'Invalidation handler error');
        }
      });
    }

    logger.info({ cache: this.name, tag, count }, 'Cache invalidated by tag');
    return count;
  }

  /**
   * Register invalidation handler
   */
  onInvalidate(tag: string, handler: () => void): () => void {
    if (!this.invalidationHandlers.has(tag)) {
      this.invalidationHandlers.set(tag, new Set());
    }
    
    this.invalidationHandlers.get(tag)!.add(handler);

    // Return unregister function
    return () => {
      this.invalidationHandlers.get(tag)?.delete(handler);
    };
  }

  /**
   * Get current cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    const avgLatency = this.stats.requestCount > 0 
      ? this.stats.totalLatency / this.stats.requestCount 
      : 0;

    let memoryUsage = 0;
    for (const entry of Array.from(this.cache.values())) {
      memoryUsage += entry.size;
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate,
      avgLatency,
      mode: this.mode,
      memoryUsage,
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0, totalLatency: 0, requestCount: 0 };
    this.modeHistory = [];
    logger.info({ cache: this.name }, 'Cache cleared');
  }

  /**
   * Get TTL based on current cache mode
   */
  private getTTLForMode(): number {
    switch (this.mode) {
      case 'HOT':
        return this.config.hotTTL;
      case 'WARM':
        return this.config.warmTTL;
      case 'COLD':
        return this.config.coldTTL;
      default:
        return this.config.defaultTTL;
    }
  }

  /**
   * Handle cache hit
   */
  private onHit(entry: CacheEntry<any>, startTime: number): void {
    this.stats.hits++;
    this.stats.requestCount++;
    this.stats.totalLatency += Date.now() - startTime;
    
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  /**
   * Handle cache miss
   */
  private onMiss(startTime: number): void {
    this.stats.misses++;
    this.stats.requestCount++;
    this.stats.totalLatency += Date.now() - startTime;
  }

  /**
   * Background revalidation
   */
  private async backgroundRevalidate<T>(
    key: string,
    factory: () => Promise<T>,
    options: any
  ): Promise<void> {
    try {
      const value = await factory();
      this.set(key, value, options);
      logger.debug({ cache: this.name, key }, 'Background revalidation complete');
    } catch (error) {
      logger.error({ cache: this.name, key, error }, 'Background revalidation failed');
    }
  }

  /**
   * Start adaptive mode management
   */
  private startAdaptiveModeManagement(): void {
    setInterval(() => {
      const stats = this.getStats();
      const previousMode = this.mode;

      // Determine new mode based on hit rate
      if (stats.hitRate >= this.config.modeThresholdHot) {
        this.mode = 'HOT';
      } else if (stats.hitRate <= this.config.modeThresholdCold) {
        this.mode = 'COLD';
      } else {
        this.mode = 'WARM';
      }

      // Log mode change
      if (previousMode !== this.mode) {
        logger.info({
          cache: this.name,
          previousMode,
          newMode: this.mode,
          hitRate: stats.hitRate,
          size: stats.size,
        }, 'Cache mode changed');
      }

      // Record history
      this.modeHistory.push({
        timestamp: Date.now(),
        mode: this.mode,
        hitRate: stats.hitRate,
      });

      // Keep last 24 hours
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      this.modeHistory = this.modeHistory.filter(h => h.timestamp > cutoff);

    }, this.config.checkInterval);
  }

  /**
   * Start memory pressure monitoring
   */
  private startMemoryPressureMonitoring(): void {
    setInterval(() => {
      const stats = this.getStats();
      
      // If memory usage exceeds threshold, aggressively evict
      if (stats.memoryUsage > this.config.maxMemory * 0.9) {
        logger.warn({
          cache: this.name,
          memoryUsage: stats.memoryUsage,
          maxMemory: this.config.maxMemory,
        }, 'Memory pressure detected - aggressive eviction');

        this.evictAggressively();
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Check if we should evict before adding
   */
  private shouldEvict(newEntrySize: number): boolean {
    const stats = this.getStats();
    return stats.size >= this.config.maxSize || 
           stats.memoryUsage + newEntrySize > this.config.maxMemory;
  }

  /**
   * Evict entries to make room
   */
  private evictForSize(neededSize: number): void {
    const toEvict: string[] = [];
    let freedSize = 0;

    // Get entries sorted by eviction policy
    const entries = Array.from(this.cache.entries());
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        break;
      case 'lfu':
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'size':
        entries.sort((a, b) => b[1].size - a[1].size); // Evict largest first
        break;
    }

    // Evict until we have enough space
    for (const [key, entry] of entries) {
      if (freedSize >= neededSize) break;
      toEvict.push(key);
      freedSize += entry.size;
    }

    // Perform eviction
    for (const key of toEvict) {
      this.cache.delete(key);
      this.stats.evictions++;
    }

    logger.debug({
      cache: this.name,
      evicted: toEvict.length,
      freedSize,
    }, 'Cache eviction completed');
  }

  /**
   * Aggressive eviction under memory pressure
   */
  private evictAggressively(): void {
    const targetSize = Math.floor(this.cache.size * 0.5); // Evict 50%
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    for (let i = 0; i < targetSize && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
      this.stats.evictions++;
    }

    logger.info({
      cache: this.name,
      evicted: targetSize,
      remaining: this.cache.size,
    }, 'Aggressive cache eviction completed');
  }

  /**
   * Estimate object size (rough approximation)
   */
  private estimateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;
    
    const str = JSON.stringify(obj);
    // Rough estimate: 2 bytes per char (UTF-16)
    return str ? str.length * 2 : 0;
  }
}

/**
 * Cache Registry
 */
class CacheRegistry {
  private caches = new Map<string, AdaptiveCache>();

  getOrCreate(name: string, config?: Partial<AdaptiveCacheConfig>): AdaptiveCache {
    if (!this.caches.has(name)) {
      this.caches.set(name, new AdaptiveCache(name, config));
    }
    return this.caches.get(name)!;
  }

  get(name: string): AdaptiveCache | undefined {
    return this.caches.get(name);
  }

  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }

  clearAll(): void {
    this.caches.forEach(cache => cache.clear());
  }

  invalidateByTag(tag: string): void {
    this.caches.forEach(cache => cache.invalidateByTag(tag));
  }
}

// Global registry
export const cacheRegistry = new CacheRegistry();

/**
 * Decorator for automatic caching
 */
export function withCache(
  cacheName: string,
  keyGenerator: (...args: any[]) => string,
  options?: {
    ttl?: number;
    tags?: string[];
    staleWhileRevalidate?: boolean;
  }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = cacheRegistry.getOrCreate(cacheName);

    descriptor.value = async function (...args: any[]) {
      const key = keyGenerator(...args);
      return cache.getOrSet(key, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

export default cacheRegistry;
