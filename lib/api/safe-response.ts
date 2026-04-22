/**
 * SAFE RESPONSE WRAPPER
 * Standardizes all API responses for consistency and security
 * 
 * Success Response Format:
 * {
 *   success: true,
 *   data: { ... },
 *   meta?: { page, limit, total }
 * }
 * 
 * Error Response Format:
 * {
 *   success: false,
 *   error: {
 *     code: "ERROR_CODE",
 *     message: "User-friendly message"
 *   }
 * }
 */

import { NextResponse } from 'next/server';

/**
 * Success response structure
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    timestamp: string;
  };
}

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  options?: {
    page?: number;
    limit?: number;
    total?: number;
    status?: number;
    headers?: Record<string, string>;
  }
): NextResponse {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...(options?.page && { page: options.page }),
      ...(options?.limit && { limit: options.limit }),
      ...(options?.total && { total: options.total }),
    },
  };

  return NextResponse.json(response, {
    status: options?.status || 200,
    headers: options?.headers,
  });
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  options?: {
    details?: Record<string, any>;
    status?: number;
    requestId?: string;
  }
): NextResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(options?.details && { details: options.details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(options?.requestId && { requestId: options.requestId }),
    },
  };

  return NextResponse.json(response, {
    status: options?.status || 400,
  });
}

/**
 * HTTP Status Code Mapping
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Common Error Codes
 */
export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Permission
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Resource
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Business Logic
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_OPERATION: 'INVALID_OPERATION',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Idempotency
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
} as const;

/**
 * Sanitize data for safe response
 * Removes sensitive fields before sending to client
 */
export function sanitizeResponse<T extends Record<string, any>>(
  data: T,
  sensitiveFields: string[] = ['password', 'secret', 'token', 'apiKey', 'privateKey']
): Partial<T> {
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item, sensitiveFields)) as any;
  }

  if (data === null || typeof data !== 'object') {
    return data;
  }

  const sanitized: Partial<T> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Skip sensitive fields
    if (sensitiveFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    )) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeResponse(value, sensitiveFields) as any;
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * Input sanitization utilities
 */
export const InputSanitizer = {
  /**
   * Trim and clean string input
   */
  string(value: string | null | undefined, maxLength = 500): string | null {
    if (value === null || value === undefined) return null;
    return value.trim().slice(0, maxLength);
  },

  /**
   * Sanitize email address
   */
  email(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.trim().toLowerCase();
  },

  /**
   * Remove HTML tags from string
   */
  plainText(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.replace(/<[^>]*>/g, '').trim();
  },

  /**
   * Sanitize array of strings
   */
  stringArray(values: string[] | null | undefined): string[] | null {
    if (!values) return null;
    return values
      .map(v => v.trim())
      .filter(v => v.length > 0);
  },

  /**
   * Normalize Arabic text
   */
  normalizeArabic(value: string | null | undefined): string | null {
    if (!value) return null;
    return value
      .trim()
      // Normalize Arabic characters
      .replace(/[ٱإأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  },
};

/**
 * Request ID generator for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract request metadata for logging/tracking
 */
export function extractRequestMeta(request: Request): {
  requestId: string;
  ip?: string;
  userAgent?: string;
  timestamp: string;
} {
  return {
    requestId: request.headers.get('x-request-id') || generateRequestId(),
    ip: request.headers.get('x-forwarded-for') || 
        request.headers.get('x-real-ip') || 
        undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    timestamp: new Date().toISOString(),
  };
}
