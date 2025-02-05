import { Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0
import now from 'performance-now'; // @version ^2.1.0
import { secureLogger } from '../utils/logger';
import { formatErrorResponse } from '../utils/errors';

// Constants for request logging configuration
const REQUEST_ID_HEADER = 'X-Request-ID';
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key'];
const PERFORMANCE_METRICS_ENABLED = process.env.ENABLE_PERFORMANCE_METRICS === 'true';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Interface for enhanced request object with timing and tracking data
 */
interface EnhancedRequest extends Request {
  id?: string;
  startTime?: number;
  user?: {
    id: string;
    organizationId: string;
  };
}

/**
 * Interface for performance metrics tracking
 */
interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  size: number;
  timestamp: Date;
}

/**
 * Sanitizes headers by redacting sensitive information
 */
const sanitizeHeaders = (headers: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> => {
  const sanitized = { ...headers };
  SENSITIVE_HEADERS.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  return sanitized;
};

/**
 * Middleware for comprehensive request logging with security and performance tracking
 */
export const requestLoggingMiddleware = (req: EnhancedRequest, res: Response, next: NextFunction): void => {
  // Generate and attach request ID
  const requestId = uuidv4();
  req.id = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Record request start time
  req.startTime = now();

  // Sanitize request data for logging
  const sanitizedRequest = {
    id: requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    headers: sanitizeHeaders(req.headers),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    organizationId: req.user?.organizationId
  };

  // Log initial request details
  secureLogger.info('Incoming request', sanitizedRequest);

  // Capture response data using interceptor
  const originalEnd = res.end;
  let responseBody: Buffer[] = [];

  // Override response write and end methods to capture data
  const oldWrite = res.write;
  const oldEnd = res.end;

  res.write = function(chunk: any): boolean {
    if (Buffer.isBuffer(chunk)) {
      responseBody.push(chunk);
    }
    return oldWrite.apply(res, arguments as any);
  };

  res.end = function(chunk: any): Response {
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        responseBody.push(chunk);
      }
    }

    // Calculate performance metrics
    const duration = now() - req.startTime!;
    const responseSize = Buffer.concat(responseBody).length;

    // Prepare performance metrics
    const metrics: RequestMetrics = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      size: responseSize,
      timestamp: new Date()
    };

    // Log response details with performance metrics
    const responseLog = {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      size: `${responseSize} bytes`,
      headers: sanitizeHeaders(res.getHeaders() as Record<string, string | string[] | undefined>)
    };

    // Log based on response status
    if (res.statusCode >= 400) {
      secureLogger.error('Request error', { ...responseLog, metrics });
    } else {
      secureLogger.info('Request completed', { ...responseLog, metrics });
    }

    // Generate audit log for significant operations
    if (req.method !== 'GET') {
      secureLogger.audit({
        action: req.method,
        resourceType: req.path.split('/')[1],
        resourceId: req.params.id,
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        metadata: {
          requestId,
          ip: req.ip,
          userAgent: req.get('user-agent')
        },
        timestamp: new Date()
      });
    }

    // Performance monitoring
    if (PERFORMANCE_METRICS_ENABLED) {
      secureLogger.debug('Performance metrics', { metrics });
    }

    // Cleanup
    responseBody = [];
    return oldEnd.apply(res, arguments as any);
  };

  next();
};

/**
 * Middleware for secure error logging with compliance considerations
 */
export const errorLoggingMiddleware = (error: Error, req: EnhancedRequest, res: Response, next: NextFunction): void => {
  const errorResponse = formatErrorResponse(error as any);

  // Enhanced error context for logging
  const errorContext = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date()
  };

  // Log error with context
  secureLogger.error(error, errorContext);

  // Generate security audit log for errors
  secureLogger.audit({
    action: 'ERROR',
    resourceType: 'error',
    resourceId: errorResponse.errorId,
    userId: req.user?.id,
    organizationId: req.user?.organizationId,
    metadata: {
      requestId: req.id,
      errorType: error.name,
      statusCode: errorResponse.status
    },
    timestamp: new Date()
  });

  next(error);
};