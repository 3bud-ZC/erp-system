/**
 * API latency tracking middleware
 * Tracks API response times for performance monitoring and alerting
 */

interface LatencyRecord {
  path: string;
  method: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  lastUpdated: number;
}

const latencyStore = new Map<string, LatencyRecord>();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get latency key from request
 */
function getLatencyKey(method: string, path: string): string {
  return `${method}:${path}`;
}

/**
 * Record API latency
 */
export function recordLatency(method: string, path: string, duration: number): void {
  const key = getLatencyKey(method, path);
  const now = Date.now();
  const record = latencyStore.get(key);

  if (!record) {
    latencyStore.set(key, {
      path,
      method,
      count: 1,
      totalDuration: duration,
      avgDuration: duration,
      maxDuration: duration,
      minDuration: duration,
      lastUpdated: now,
    });
  } else {
    record.count++;
    record.totalDuration += duration;
    record.avgDuration = record.totalDuration / record.count;
    record.maxDuration = Math.max(record.maxDuration, duration);
    record.minDuration = Math.min(record.minDuration, duration);
    record.lastUpdated = now;
    latencyStore.set(key, record);
  }

  // Alert on slow requests
  if (duration > 5000) { // 5 seconds
    console.warn(`Slow API request: ${method} ${path} took ${duration}ms`);
  }
}

/**
 * Get latency statistics for a specific endpoint
 */
export function getLatencyStats(method: string, path: string): LatencyRecord | null {
  const key = getLatencyKey(method, path);
  return latencyStore.get(key) || null;
}

/**
 * Get all latency statistics
 */
export function getAllLatencyStats(): LatencyRecord[] {
  return Array.from(latencyStore.values());
}

/**
 * Get slow endpoints (avg duration > 1s)
 */
export function getSlowEndpoints(thresholdMs: number = 1000): LatencyRecord[] {
  return Array.from(latencyStore.values()).filter(
    record => record.avgDuration > thresholdMs
  ).sort((a, b) => b.avgDuration - a.avgDuration);
}

/**
 * Clean up old records
 */
export function cleanupLatencyRecords(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  latencyStore.forEach((record, key) => {
    if (now - record.lastUpdated > MAX_AGE) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => latencyStore.delete(key));
}

// Cleanup old records periodically
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupLatencyRecords, CLEANUP_INTERVAL);
}

/**
 * Middleware wrapper to track API latency
 */
export function withLatencyTracking(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    try {
      const response = await handler(request);
      const duration = Date.now() - startTime;
      
      recordLatency(request.method, url.pathname, duration);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      recordLatency(request.method, url.pathname, duration);
      
      throw error;
    }
  };
}
