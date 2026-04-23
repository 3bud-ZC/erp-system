/**
 * STRUCTURED LOGGER
 * Production-grade logging with Pino
 * 
 * Features:
 * - JSON structured output
 * - Request ID correlation
 * - Automatic redaction of sensitive fields
 * - Log levels: trace, debug, info, warn, error, fatal
 * - Performance-optimized (async logging)
 */

import pino from 'pino';

// Logger configuration
// NOTE: pino-pretty transport uses worker threads which are incompatible
// with Next.js webpack bundling — use plain JSON output instead.
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'secret',
      'token',
      'apiKey',
      'privateKey',
      'authorization',
      '*.password',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },

  // Base metadata for all logs
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version,
  },

  // No transport — output JSON to stdout directly (Next.js compatible)
  transport: undefined as any,
};

// Create main logger instance
export const logger = pino(loggerConfig);

/**
 * Create child logger with request context
 */
export function createRequestLogger(requestId: string, context?: {
  userId?: string;
  tenantId?: string;
  path?: string;
  method?: string;
}) {
  return logger.child({
    requestId,
    ...context,
  });
}

/**
 * Log levels helper
 */
export const LogLevel = {
  TRACE: 10,
  DEBUG: 20,
  INFO: 30,
  WARN: 40,
  ERROR: 50,
  FATAL: 60,
} as const;

/**
 * Performance logger
 * Measures and logs operation timing
 */
export class PerformanceLogger {
  private startTime: number;
  private requestLogger: any;
  private operation: string;
  
  constructor(requestLogger: any, operation: string) {
    this.startTime = Date.now();
    this.requestLogger = requestLogger;
    this.operation = operation;
  }
  
  end(metadata?: Record<string, any>) {
    const duration = Date.now() - this.startTime;
    
    this.requestLogger.info({
      operation: this.operation,
      duration,
      durationMs: duration,
      slow: duration > 500, // Flag slow operations
      ...metadata,
    }, `${this.operation} completed in ${duration}ms`);
    
    return duration;
  }
  
  fail(error: Error, metadata?: Record<string, any>) {
    const duration = Date.now() - this.startTime;
    
    this.requestLogger.error({
      operation: this.operation,
      duration,
      durationMs: duration,
      error: error.message,
      stack: error.stack,
      ...metadata,
    }, `${this.operation} failed after ${duration}ms`);
    
    return duration;
  }
}

/**
 * Request lifecycle logger
 */
export function logRequestStart(
  requestLogger: any,
  method: string,
  path: string,
  userAgent?: string
) {
  requestLogger.info({
    type: 'request_start',
    method,
    path,
    userAgent,
  }, `→ ${method} ${path}`);
}

export function logRequestEnd(
  requestLogger: any,
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  error?: Error
) {
  const level = error ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  const emoji = error ? '✕' : statusCode >= 400 ? '⚠' : '✓';
  
  requestLogger[level]({
    type: 'request_end',
    method,
    path,
    statusCode,
    durationMs,
    slow: durationMs > 500,
    ...(error && { error: error.message }),
  }, `${emoji} ${method} ${path} ${statusCode} ${durationMs}ms`);
}

/**
 * Database operation logger
 */
export function logDbOperation(
  requestLogger: any,
  operation: string,
  model: string,
  durationMs: number,
  error?: Error
) {
  const level = error ? 'error' : durationMs > 100 ? 'warn' : 'debug';
  
  requestLogger[level]({
    type: 'db_operation',
    operation,
    model,
    durationMs,
    slow: durationMs > 100,
    ...(error && { error: error.message }),
  }, `DB ${operation} ${model} ${durationMs}ms`);
}

/**
 * Audit event logger
 */
export function logAuditEvent(
  requestLogger: any,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, any>
) {
  requestLogger.info({
    type: 'audit',
    action,
    entityType,
    entityId,
    ...metadata,
  }, `Audit: ${action} ${entityType} ${entityId}`);
}

/**
 * Security event logger
 */
export function logSecurityEvent(
  requestLogger: any,
  event: 'auth_failure' | 'permission_denied' | 'suspicious_activity',
  details: Record<string, any>
) {
  requestLogger.warn({
    type: 'security',
    event,
    ...details,
  }, `Security: ${event}`);
}

export default logger;
