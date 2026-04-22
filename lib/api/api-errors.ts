/**
 * Standard API Error Format
 * Production-grade error handling with consistent structure
 */

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // General errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  IDEMPOTENCY_KEY_REUSE = 'IDEMPOTENCY_KEY_REUSE',

  // Business logic errors
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_ACCOUNTING_PERIOD = 'INVALID_ACCOUNTING_PERIOD',
  INVALID_FISCAL_YEAR = 'INVALID_FISCAL_YEAR',
  ACCOUNTING_ENTRY_UNBALANCED = 'ACCOUNTING_ENTRY_UNBALANCED',
  POSTED_ENTRY_MODIFICATION = 'POSTED_ENTRY_MODIFICATION',
  CREDIT_LIMIT_EXCEEDED = 'CREDIT_LIMIT_EXCEEDED',

  // Multi-tenant errors
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  CROSS_TENANT_ACCESS = 'CROSS_TENANT_ACCESS',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

// ============================================================================
// API ERROR CLASS
// ============================================================================

export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// ============================================================================
// STANDARD ERROR FACTORIES
// ============================================================================

export const Errors = {
  internal: (message: string = 'An internal server error occurred', details?: any) =>
    new APIError(ErrorCode.INTERNAL_SERVER_ERROR, message, 500, details),

  badRequest: (message: string = 'Bad request', details?: any) =>
    new APIError(ErrorCode.BAD_REQUEST, message, 400, details),

  unauthorized: (message: string = 'Unauthorized') =>
    new APIError(ErrorCode.UNAUTHORIZED, message, 401),

  forbidden: (message: string = 'Forbidden') =>
    new APIError(ErrorCode.FORBIDDEN, message, 403),

  notFound: (resource: string = 'Resource') =>
    new APIError(ErrorCode.NOT_FOUND, `${resource} not found`, 404),

  conflict: (message: string = 'Conflict', details?: any) =>
    new APIError(ErrorCode.CONFLICT, message, 409, details),

  validation: (message: string = 'Validation failed', details?: any) =>
    new APIError(ErrorCode.VALIDATION_ERROR, message, 400, details),

  rateLimit: (message: string = 'Rate limit exceeded') =>
    new APIError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429),

  idempotencyReuse: (message: string = 'Idempotency key already used') =>
    new APIError(ErrorCode.IDEMPOTENCY_KEY_REUSE, message, 409),

  insufficientStock: (productName: string, available: number, required: number) =>
    new APIError(
      ErrorCode.INSUFFICIENT_STOCK,
      `Insufficient stock for ${productName}. Available: ${available}, Required: ${required}`,
      400
    ),

  invalidAccountingPeriod: (message: string = 'Invalid accounting period') =>
    new APIError(ErrorCode.INVALID_ACCOUNTING_PERIOD, message, 400),

  invalidFiscalYear: (message: string = 'Invalid fiscal year') =>
    new APIError(ErrorCode.INVALID_FISCAL_YEAR, message, 400),

  accountingEntryUnbalanced: (debit: number, credit: number) =>
    new APIError(
      ErrorCode.ACCOUNTING_ENTRY_UNBALANCED,
      `Accounting entry is unbalanced. Debit: ${debit}, Credit: ${credit}`,
      400
    ),

  postedEntryModification: (message: string = 'Cannot modify posted entry') =>
    new APIError(ErrorCode.POSTED_ENTRY_MODIFICATION, message, 400),

  creditLimitExceeded: (customerName: string, limit: number, current: number) =>
    new APIError(
      ErrorCode.CREDIT_LIMIT_EXCEEDED,
      `Credit limit exceeded for ${customerName}. Limit: ${limit}, Current: ${current}`,
      400
    ),

  tenantNotFound: (tenantId: string) =>
    new APIError(ErrorCode.TENANT_NOT_FOUND, `Tenant ${tenantId} not found`, 404),

  crossTenantAccess: (message: string = 'Cross-tenant access denied') =>
    new APIError(ErrorCode.CROSS_TENANT_ACCESS, message, 403),

  permissionDenied: (permission: string) =>
    new APIError(ErrorCode.PERMISSION_DENIED, `Permission denied: ${permission}`, 403),
};

// ============================================================================
// ERROR RESPONSE FORMATTER
// ============================================================================

export function formatErrorResponse(error: unknown): Response {
  if (error instanceof APIError) {
    return Response.json(error.toJSON(), { status: error.statusCode });
  }

  if (error instanceof Error) {
    const apiError = Errors.internal(error.message);
    return Response.json(apiError.toJSON(), { status: 500 });
  }

  const apiError = Errors.internal();
  return Response.json(apiError.toJSON(), { status: 500 });
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

export function withErrorHandler(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return formatErrorResponse(error);
    }
  };
}
