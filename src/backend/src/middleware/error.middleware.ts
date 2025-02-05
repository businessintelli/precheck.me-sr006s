import { Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import * as Sentry from '@sentry/node'; // @version ^7.0.0
import { logger } from '../utils/logger';
import { BaseError, formatErrorResponse } from '../utils/errors';
import { API_RATE_LIMITS } from '../utils/constants';

/**
 * Interface for enhanced error tracking with security context
 */
interface ErrorContext {
  requestId: string;
  path: string;
  method: string;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Global error handling middleware with enhanced security, monitoring,
 * and environment-specific error handling capabilities
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique error tracking ID
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();

  // Build secure error context with PII protection
  const errorContext: ErrorContext = {
    requestId,
    path: req.path,
    method: req.method,
    timestamp: new Date(),
    userId: req.user?.id,
    organizationId: req.user?.organization_id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  // Sanitize error stack trace in production
  if (process.env.NODE_ENV === 'production') {
    delete error.stack;
  }

  // Log error with security context
  logger.error(error, {
    context: errorContext,
    type: 'REQUEST_ERROR',
    severity: error instanceof BaseError ? error.statusCode >= 500 ? 'ERROR' : 'WARNING' : 'ERROR'
  });

  // Report error to Sentry in production with security context
  if (process.env.NODE_ENV === 'production') {
    Sentry.withScope((scope) => {
      scope.setUser({
        id: errorContext.userId,
        ip_address: errorContext.ip
      });
      scope.setExtra('requestContext', {
        ...errorContext,
        headers: sanitizeHeaders(req.headers)
      });
      scope.setTag('requestId', requestId);
      Sentry.captureException(error);
    });
  }

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Error details:', {
      error: error.message,
      stack: error.stack,
      context: errorContext
    });
  }

  // Handle rate limit errors
  if (error.name === 'RateLimitError') {
    const retryAfter = calculateRetryAfter(req);
    res.set('Retry-After', String(retryAfter));
  }

  // Format error response based on error type and environment
  const errorResponse = error instanceof BaseError
    ? formatErrorResponse(error)
    : {
        status: 'error',
        message: 'Internal Server Error',
        errorId: requestId,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      };

  // Set appropriate status code
  const statusCode = error instanceof BaseError ? error.statusCode : 500;

  // Set security headers
  setSecurityHeaders(res);

  // Send error response
  res.status(statusCode).json({
    ...errorResponse,
    requestId,
    timestamp: errorContext.timestamp
  });
};

/**
 * Sanitizes request headers to remove sensitive information
 */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  const sanitized = { ...headers };

  sensitiveHeaders.forEach(header => {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Calculates retry-after period for rate limited requests
 */
function calculateRetryAfter(req: Request): number {
  const endpoint = req.path.split('/')[1] || 'DEFAULT';
  const rateLimit = API_RATE_LIMITS[endpoint.toUpperCase()] || API_RATE_LIMITS.DEFAULT;
  return Math.ceil(3600 / rateLimit); // Convert rate limit to seconds
}

/**
 * Sets security-related response headers
 */
function setSecurityHeaders(res: Response): void {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
}