/**
 * IDEMPOTENCY MIDDLEWARE
 * Prevents duplicate operations using Idempotency-Key header
 * 
 * Usage:
 *   1. Client generates unique key (UUID recommended)
 *   2. Client sends: headers: { 'Idempotency-Key': 'uuid-here' }
 *   3. Server stores key -> response mapping
 *   4. If same key reused → return cached response
 */

import { prisma } from '@/lib/db';
import { idempotencyKeySchema } from '@/lib/validation/schemas';

/**
 * Idempotency record structure
 */
interface IdempotencyRecord {
  key: string;
  tenantId: string;
  userId: string;
  requestPath: string;
  requestMethod: string;
  responseStatus: number;
  responseBody: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Idempotency key TTL in milliseconds (24 hours)
 */
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

/**
 * Extract idempotency key from request headers
 */
export function extractIdempotencyKey(request: Request): string | null {
  const key = request.headers.get('idempotency-key') || 
              request.headers.get('Idempotency-Key') ||
              request.headers.get('IDEMPOTENCY-KEY');
  
  if (!key) return null;
  
  // Validate format
  const result = idempotencyKeySchema.safeParse(key.trim());
  return result.success ? result.data : null;
}

/**
 * Check if idempotency key exists and return cached response
 */
export async function checkIdempotency(
  key: string,
  tenantId: string,
  requestPath: string,
  requestMethod: string
): Promise<{ found: false } | { found: true; status: number; body: any }> {
  try {
    // Look for existing record
    const record = await prisma.idempotencyKey.findUnique({
      where: {
        key_tenantId: {
          key,
          tenantId,
        },
      },
    });

    // No record found
    if (!record) {
      return { found: false };
    }

    // Check if request matches (prevent cross-endpoint replay attacks)
    if (record.requestPath !== requestPath || record.requestMethod !== requestMethod) {
      // Key exists but for different endpoint - reject
      return { found: false };
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      // Expired - treat as new request
      await prisma.idempotencyKey.delete({
        where: { id: record.id },
      });
      return { found: false };
    }

    // Return cached response
    return {
      found: true,
      status: record.responseStatus,
      body: JSON.parse(record.responseBody),
    };
  } catch (error) {
    console.error('Idempotency check error:', error);
    // On error, allow request to proceed (fail open)
    return { found: false };
  }
}

/**
 * Store idempotency response for future reuse
 */
export async function storeIdempotency(
  key: string,
  tenantId: string,
  userId: string,
  requestPath: string,
  requestMethod: string,
  responseStatus: number,
  responseBody: any
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL);

    await prisma.idempotencyKey.create({
      data: {
        key,
        tenantId,
        userId,
        requestPath,
        requestMethod,
        responseStatus,
        responseBody: JSON.stringify(responseBody),
        expiresAt,
      },
    });
  } catch (error) {
    // Log but don't fail the request if storage fails
    console.error('Failed to store idempotency key:', error);
  }
}

/**
 * Idempotency middleware for API routes
 * 
 * Usage in API routes:
 * 
 * export async function POST(request: Request) {
 *   // 1. Check idempotency
 *   const idempotencyCheck = await withIdempotency(request, async () => {
 *     // 2. Your actual handler logic
 *     const result = await createInvoice(data);
 *     return { success: true, data: result };
 *   });
 * 
 *   return Response.json(idempotencyCheck.body, { 
 *     status: idempotencyCheck.status 
 *   });
 * }
 */
export async function withIdempotency<T>(
  request: Request,
  tenantId: string,
  userId: string,
  handler: () => Promise<{ status: number; body: T }>
): Promise<{ status: number; body: T; fromCache?: boolean }> {
  const key = extractIdempotencyKey(request);
  
  // No idempotency key - proceed normally
  if (!key) {
    return handler();
  }

  const url = new URL(request.url);
  
  // Check for existing response
  const existing = await checkIdempotency(
    key,
    tenantId,
    url.pathname,
    request.method
  );

  if (existing.found) {
    // Return cached response with indicator
    return {
      status: existing.status,
      body: existing.body,
      fromCache: true,
    };
  }

  // Execute handler
  const result = await handler();

  // Store for future idempotent requests (only for successful mutations)
  if (result.status >= 200 && result.status < 300) {
    await storeIdempotency(
      key,
      tenantId,
      userId,
      url.pathname,
      request.method,
      result.status,
      result.body
    );
  }

  return result;
}

/**
 * Clean up expired idempotency keys
 * Call this periodically (e.g., via cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    
    console.log(`Cleaned up ${result.count} expired idempotency keys`);
    return result.count;
  } catch (error) {
    console.error('Failed to cleanup idempotency keys:', error);
    return 0;
  }
}
