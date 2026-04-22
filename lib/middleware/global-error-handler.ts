/**
 * GLOBAL ERROR HANDLER
 * Standardized error handling for all API routes
 * 
 * Features:
 * - No raw errors sent to client
 * - Safe error messages (no internal details leaked)
 * - Structured error codes
 * - Internal error logging
 */

import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Application Error Codes
 */
export type ErrorCode =
  // Validation Errors (400)
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_FORMAT'
  // Authentication Errors (401)
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  // Authorization Errors (403)
  | 'FORBIDDEN'
  | 'INSUFFICIENT_PERMISSIONS'
  // Not Found Errors (404)
  | 'NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  // Conflict Errors (409)
  | 'CONFLICT'
  | 'DUPLICATE_ENTRY'
  | 'INSUFFICIENT_STOCK'
  // Rate Limit Errors (429)
  | 'RATE_LIMIT_EXCEEDED'
  | 'TOO_MANY_REQUESTS'
  // Server Errors (500)
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'TRANSACTION_FAILED'
  | 'INTEGRATION_ERROR';

/**
 * Structured Application Error
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number,
    public details?: Record<string, any>,
    public internalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error response structure sent to clients
 */
interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  requestId?: string;
}

/**
 * Safe error message mapping
 * Prevents leaking internal details to clients
 */
const safeErrorMessages: Record<ErrorCode, string> = {
  // Validation
  VALIDATION_ERROR: 'Invalid request data',
  INVALID_INPUT: 'Invalid input provided',
  MISSING_REQUIRED_FIELD: 'Required field is missing',
  INVALID_FORMAT: 'Invalid data format',
  // Auth
  UNAUTHORIZED: 'Authentication required',
  INVALID_TOKEN: 'Invalid authentication token',
  TOKEN_EXPIRED: 'Session expired, please login again',
  // Authorization
  FORBIDDEN: 'Access denied',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this operation',
  // Not Found
  NOT_FOUND: 'Resource not found',
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  // Conflict
  CONFLICT: 'Resource conflict',
  DUPLICATE_ENTRY: 'A record with this information already exists',
  INSUFFICIENT_STOCK: 'Insufficient stock available',
  // Rate Limit
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded, please try again later',
  TOO_MANY_REQUESTS: 'Too many requests, please slow down',
  // Server
  INTERNAL_ERROR: 'An internal error occurred',
  DATABASE_ERROR: 'Database operation failed',
  TRANSACTION_FAILED: 'Transaction failed, please try again',
  INTEGRATION_ERROR: 'External service error',
};

/**
 * Get safe error message for client
 */
function getSafeErrorMessage(code: ErrorCode, originalMessage: string): string {
  // For server errors, never expose internal details
  if (code === 'INTERNAL_ERROR' || code === 'DATABASE_ERROR' || code === 'TRANSACTION_FAILED') {
    return safeErrorMessages[code];
  }
  // For other errors, use predefined safe message or sanitized original
  return safeErrorMessages[code] || originalMessage;
}

/**
 * Log error internally (safe for sensitive data)
 */
function logError(error: Error, context: {
  code?: ErrorCode;
  path?: string;
  method?: string;
  userId?: string;
  tenantId?: string;
  requestId?: string;
}): void {
  const timestamp = new Date().toISOString();
  
  // Structured error log
  const errorLog = {
    timestamp,
    level: 'ERROR',
    type: error.name,
    code: context.code || 'UNKNOWN',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    ...context,
    // Include original error details for debugging
    originalError: error instanceof AppError ? {
      internalMessage: error.internalError?.message,
      internalStack: error.internalError?.stack,
    } : undefined,
  };

  // In production, send to logging service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to Datadog, CloudWatch, etc.
    console.error('PRODUCTION_ERROR:', JSON.stringify(errorLog));
  } else {
    console.error('ERROR:', errorLog);
  }
}

/**
 * Handle Zod validation errors
 */
function handleZodError(error: ZodError): AppError {
  const issues = error.issues.map(issue => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

  return new AppError(
    'VALIDATION_ERROR',
    'Request validation failed',
    400,
    { fields: issues }
  );
}

/**
 * Handle Prisma database errors
 */
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): AppError {
  switch (error.code) {
    case 'P2002': // Unique constraint violation
      return new AppError(
        'DUPLICATE_ENTRY',
        'A record with this information already exists',
        409,
        { field: error.meta?.target }
      );
    
    case 'P2025': // Record not found
      return new AppError(
        'NOT_FOUND',
        'The requested resource was not found',
        404
      );
    
    case 'P2003': // Foreign key constraint
      return new AppError(
        'VALIDATION_ERROR',
        'Invalid reference to related resource',
        400
      );
    
    case 'P2024': // Timeout
      return new AppError(
        'TRANSACTION_FAILED',
        'Operation timed out, please try again',
        504
      );
    
    default:
      return new AppError(
        'DATABASE_ERROR',
        'Database operation failed',
        500,
        { prismaCode: error.code },
        error
      );
  }
}

/**
 * Main error handler - converts any error to safe response
 */
export function handleError(
  error: unknown,
  context: {
    path?: string;
    method?: string;
    userId?: string;
    tenantId?: string;
    requestId?: string;
  } = {}
): { status: number; body: ErrorResponse } {
  let appError: AppError;

  // Convert different error types to AppError
  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = handleZodError(error);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    appError = handlePrismaError(error);
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    appError = new AppError(
      'VALIDATION_ERROR',
      'Invalid data provided',
      400,
      undefined,
      error as Error
    );
  } else if (error instanceof Error) {
    // Generic error
    appError = new AppError(
      'INTERNAL_ERROR',
      error.message,
      500,
      undefined,
      error
    );
  } else {
    // Unknown error type
    appError = new AppError(
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      500
    );
  }

  // Log the error internally
  logError(appError, {
    code: appError.code,
    ...context,
  });

  // Build safe response
  const response: ErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: getSafeErrorMessage(appError.code, appError.message),
      // Only include details for non-server errors
      ...(appError.statusCode < 500 && appError.details && {
        details: appError.details,
      }),
    },
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
  };

  return {
    status: appError.statusCode,
    body: response,
  };
}

/**
 * Helper to create specific error types
 */
export const Errors = {
  validation: (message: string, details?: Record<string, any>) =>
    new AppError('VALIDATION_ERROR', message, 400, details),
  
  unauthorized: (message = 'Authentication required') =>
    new AppError('UNAUTHORIZED', message, 401),
  
  forbidden: (message = 'Access denied') =>
    new AppError('FORBIDDEN', message, 403),
  
  notFound: (message = 'Resource not found') =>
    new AppError('NOT_FOUND', message, 404),
  
  conflict: (message: string, details?: Record<string, any>) =>
    new AppError('CONFLICT', message, 409, details),
  
  rateLimit: (message = 'Rate limit exceeded') =>
    new AppError('RATE_LIMIT_EXCEEDED', message, 429),
  
  internal: (message = 'Internal error', internalError?: Error) =>
    new AppError('INTERNAL_ERROR', message, 500, undefined, internalError),
};

/**
 * Express/Next.js style error handler middleware
 */
export function withErrorHandler<T>(
  handler: () => Promise<T>,
  context: {
    path?: string;
    method?: string;
    userId?: string;
    tenantId?: string;
    requestId?: string;
  }
): Promise<{ success: true; data: T } | { success: false; error: ErrorResponse }> {
  return handler()
    .then(data => ({ success: true as const, data }))
    .catch(error => {
      const { body } = handleError(error, context);
      return { success: false as const, error: body };
    });
}
