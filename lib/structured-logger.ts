/**
 * Structured logging system for production-grade observability
 * Provides consistent, queryable logs for API calls, errors, and performance
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface LogContext {
  userId?: string;
  tenantId?: string;
  requestId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number; // For performance logging
}

class StructuredLogger {
  private isProduction = process.env.NODE_ENV === 'production';

  private formatLog(entry: LogEntry): string {
    const { timestamp, level, message, context, data, error, duration } = entry;
    
    const logObj: any = {
      timestamp,
      level,
      message,
      ...context,
    };

    if (data) {
      logObj.data = data;
    }

    if (error) {
      logObj.error = {
        name: error.name,
        message: error.message,
      };
      if (this.isProduction) {
        // In production, don't log full stack to avoid noise
        logObj.error.stack = error.stack?.split('\n').slice(0, 3).join('\n');
      } else {
        logObj.error.stack = error.stack;
      }
    }

    if (duration !== undefined) {
      logObj.duration = `${duration}ms`;
    }

    return JSON.stringify(logObj);
  }

  private log(level: LogLevel, message: string, context?: LogContext, data?: any, error?: Error, duration?: number): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      duration,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const formattedLog = this.formatLog(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (!this.isProduction) console.debug(formattedLog);
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formattedLog);
        break;
    }
  }

  debug(message: string, context?: LogContext, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: LogContext, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: LogContext, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, error: Error, context?: LogContext, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  fatal(message: string, error: Error, context?: LogContext, data?: any): void {
    this.log(LogLevel.FATAL, message, context, data, error);
  }

  /**
   * Log API request with performance tracking
   */
  logApiRequest(
    method: string,
    path: string,
    context: LogContext,
    statusCode: number,
    duration: number
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${method} ${path} - ${statusCode}`;

    this.log(level, message, context, { statusCode }, undefined, duration);
  }

  /**
   * Log database query performance
   */
  logQuery(query: string, duration: number, context?: LogContext): void {
    if (duration > 1000) { // Log slow queries (>1s)
      this.warn('Slow database query', context, { query, duration });
    } else if (duration > 100) { // Log medium queries (>100ms)
      this.debug('Database query', context, { query, duration });
    }
  }

  /**
   * Log business operation
   */
  logOperation(operation: string, context?: LogContext, data?: any): void {
    this.info(operation, context, data);
  }
}

export const logger = new StructuredLogger();

/**
 * Create a performance timer
 */
export function createTimer(): { start: () => void; end: () => number } {
  let startTime: number;

  return {
    start: () => {
      startTime = Date.now();
    },
    end: () => Date.now() - startTime,
  };
}
