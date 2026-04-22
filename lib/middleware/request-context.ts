/**
 * REQUEST CONTEXT MIDDLEWARE
 * Manages request ID and context throughout the request lifecycle
 * 
 * Features:
 * - Request ID generation/correlation
 * - Request timing
 * - Context propagation to all layers
 */

import { NextResponse } from 'next/server';
import { createRequestLogger, logRequestStart, logRequestEnd, PerformanceLogger } from '@/lib/logger';
import { extractRequestMeta } from '@/lib/api/safe-response';

/**
 * Request context structure
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  tenantId?: string;
  logger: any;
}

/**
 * AsyncLocalStorage for request context (Node.js 14.8+)
 * Allows accessing context without explicit passing
 */
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get current request context (from async storage)
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get request logger from context
 */
export function getRequestLogger(): any {
  const context = getRequestContext();
  return context?.logger || require('@/lib/logger').logger;
}

/**
 * Get request ID from context
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

/**
 * Create performance logger for operation timing
 */
export function createPerfLogger(operation: string): PerformanceLogger {
  const context = getRequestContext();
  if (!context) {
    throw new Error('No request context available');
  }
  return new PerformanceLogger(context.logger, operation);
}

/**
 * Request context middleware
 * Wraps handler with context setup and teardown
 */
export async function withRequestContext<T>(
  request: Request,
  handler: (context: RequestContext) => Promise<T>
): Promise<T> {
  // Extract or generate request ID
  const meta = extractRequestMeta(request);
  const requestId = meta.requestId;
  
  // Create request logger
  const url = new URL(request.url);
  const logger = createRequestLogger(requestId, {
    path: url.pathname,
    method: request.method,
  });
  
  // Build context
  const context: RequestContext = {
    requestId,
    startTime: Date.now(),
    logger,
  };
  
  // Log request start
  logRequestStart(logger, request.method, url.pathname, meta.userAgent);
  
  // Run handler within context
  return asyncLocalStorage.run(context, async () => {
    try {
      const result = await handler(context);
      
      // Log request end
      const duration = Date.now() - context.startTime;
      logRequestEnd(logger, request.method, url.pathname, 200, duration);
      
      return result;
    } catch (error) {
      // Log request failure
      const duration = Date.now() - context.startTime;
      logRequestEnd(
        logger,
        request.method,
        url.pathname,
        500,
        duration,
        error as Error
      );
      throw error;
    }
  });
}

/**
 * Next.js App Router compatible middleware
 */
export function requestContextMiddleware(
  handler: (request: Request, context: RequestContext) => Promise<NextResponse>
) {
  return async (request: Request): Promise<NextResponse> => {
    return withRequestContext(request, async (reqContext) => {
      // Add request ID to response headers
      const response = await handler(request, reqContext);
      response.headers.set('x-request-id', reqContext.requestId);
      return response;
    });
  };
}

/**
 * Middleware for Next.js (app router)
 */
export async function requestMiddleware(request: Request) {
  const meta = extractRequestMeta(request);
  const requestId = meta.requestId;
  
  // Create context
  const url = new URL(request.url);
  const logger = createRequestLogger(requestId, {
    path: url.pathname,
    method: request.method,
  });
  
  const context: RequestContext = {
    requestId,
    startTime: Date.now(),
    logger,
  };
  
  // Store in async local storage for this request
  asyncLocalStorage.enterWith(context);
  
  logRequestStart(logger, request.method, url.pathname, meta.userAgent);
  
  return {
    context,
    logger,
    end: (statusCode: number, error?: Error) => {
      const duration = Date.now() - context.startTime;
      logRequestEnd(logger, request.method, url.pathname, statusCode, duration, error);
    },
  };
}
