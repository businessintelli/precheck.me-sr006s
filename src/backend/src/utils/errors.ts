import * as Sentry from '@sentry/node'; // @version ^7.0.0
import { NODE_ENV } from './constants';
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0

/**
 * Enhanced base error class with security-aware error handling and monitoring integration
 */
export class BaseError extends Error {
  public readonly statusCode: number;
  public readonly details: Record<string, unknown>;
  public readonly errorId: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = this.sanitizeErrorDetails(details);
    this.errorId = uuidv4();
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
    logError(this);
  }

  /**
   * Sanitizes error details to prevent sensitive information exposure
   */
  private sanitizeErrorDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...details };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

/**
 * Specialized error class for validation failures with detailed error reporting
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; code?: string }>
  ) {
    super(message, 400, { validationErrors });
    this.validationErrors = validationErrors;
  }
}

/**
 * Internal utility function for secure error logging based on environment
 */
function logError(error: BaseError): void {
  const errorContext = {
    errorId: error.errorId,
    timestamp: error.timestamp,
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    stack: error.stack
  };

  if (NODE_ENV === 'development') {
    console.error('[Error]', errorContext);
  } else {
    // Production error logging with Sentry
    Sentry.captureException(error, {
      extra: {
        errorId: error.errorId,
        details: error.details,
        timestamp: error.timestamp.toISOString()
      },
      tags: {
        errorType: error.name,
        statusCode: error.statusCode.toString()
      }
    });
  }
}

/**
 * Formats error objects into standardized API response format with environment-specific detail levels
 */
export function formatErrorResponse(error: BaseError): {
  status: 'error';
  message: string;
  errorId: string;
  details?: Record<string, unknown>;
  stack?: string;
} {
  const response = {
    status: 'error' as const,
    message: error.message,
    errorId: error.errorId
  };

  // Include error details in development environment
  if (NODE_ENV === 'development') {
    return {
      ...response,
      details: error.details,
      stack: error.stack
    };
  }

  // Production response with minimal details
  if (error instanceof ValidationError) {
    return {
      ...response,
      details: {
        validationErrors: error.validationErrors
      }
    };
  }

  return response;
}

/**
 * HTTP-specific error classes for common scenarios
 */
export class NotFoundError extends BaseError {
  constructor(message: string = 'Resource not found', details?: Record<string, unknown>) {
    super(message, 404, details);
  }
}

export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized access', details?: Record<string, unknown>) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string = 'Access forbidden', details?: Record<string, unknown>) {
    super(message, 403, details);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string = 'Resource conflict', details?: Record<string, unknown>) {
    super(message, 409, details);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', details?: Record<string, unknown>) {
    super(message, 429, details);
  }
}

export class InternalServerError extends BaseError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(message, 500, details);
  }
}

/**
 * Type guard to check if an error is an instance of BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}