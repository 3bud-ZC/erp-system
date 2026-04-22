/**
 * Brute-force protection for authentication endpoints
 * Tracks failed login attempts and blocks suspicious IPs/users
 */

interface FailedAttemptRecord {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

const failedAttemptsStore = new Map<string, FailedAttemptRecord>();

const BRUTE_FORCE_CONFIG = {
  maxAttempts: 5, // Max failed attempts before blocking
  blockDurationMs: 15 * 60 * 1000, // 15 minutes block
  resetDurationMs: 30 * 60 * 1000, // 30 minutes to reset counter
};

/**
 * Check if identifier is blocked due to brute-force attempts
 */
export function isBlocked(identifier: string): boolean {
  const record = failedAttemptsStore.get(identifier);
  if (!record) return false;

  // Check if block has expired
  if (record.blockedUntil && record.blockedUntil > Date.now()) {
    return true;
  }

  // Check if counter should be reset
  if (Date.now() - record.lastAttempt > BRUTE_FORCE_CONFIG.resetDurationMs) {
    failedAttemptsStore.delete(identifier);
    return false;
  }

  return false;
}

/**
 * Record failed login attempt
 */
export function recordFailedAttempt(identifier: string): {
  blocked: boolean;
  remainingAttempts: number;
  blockDuration?: number;
} {
  const now = Date.now();
  const record = failedAttemptsStore.get(identifier);

  if (!record) {
    // First failed attempt
    failedAttemptsStore.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return {
      blocked: false,
      remainingAttempts: BRUTE_FORCE_CONFIG.maxAttempts - 1,
    };
  }

  // Check if record should be reset (too old)
  if (now - record.lastAttempt > BRUTE_FORCE_CONFIG.resetDurationMs) {
    failedAttemptsStore.set(identifier, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });
    return {
      blocked: false,
      remainingAttempts: BRUTE_FORCE_CONFIG.maxAttempts - 1,
    };
  }

  // Increment failed attempts
  record.count++;
  record.lastAttempt = now;

  // Check if should block
  if (record.count >= BRUTE_FORCE_CONFIG.maxAttempts) {
    record.blockedUntil = now + BRUTE_FORCE_CONFIG.blockDurationMs;
    failedAttemptsStore.set(identifier, record);
    return {
      blocked: true,
      remainingAttempts: 0,
      blockDuration: BRUTE_FORCE_CONFIG.blockDurationMs,
    };
  }

  failedAttemptsStore.set(identifier, record);
  return {
    blocked: false,
    remainingAttempts: BRUTE_FORCE_CONFIG.maxAttempts - record.count,
  };
}

/**
 * Clear failed attempts (called on successful login)
 */
export function clearFailedAttempts(identifier: string): void {
  failedAttemptsStore.delete(identifier);
}

/**
 * Get brute-force protection identifier from request
 */
export async function getBruteForceIdentifier(request: Request): Promise<string> {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  try {
    const body = await request.clone().json();
    const email = body.email;
    return email ? `email:${email}` : `ip:${ip}`;
  } catch {
    return `ip:${ip}`;
  }
}

/**
 * Get remaining block time in seconds
 */
export function getRemainingBlockTime(identifier: string): number {
  const record = failedAttemptsStore.get(identifier);
  if (!record || !record.blockedUntil) return 0;
  
  const remaining = Math.ceil((record.blockedUntil - Date.now()) / 1000);
  return Math.max(0, remaining);
}
