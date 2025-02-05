import { Request, Response, NextFunction } from 'express'; // @version ^4.18.0
import { z } from 'zod'; // @version ^3.22.0
import sanitize from 'xss'; // @version ^1.0.14
import rateLimit from 'express-rate-limit'; // @version ^6.7.0
import { ValidationError } from '../utils/errors';
import { validateDTO } from '../utils/validators';
import { API_RATE_LIMITS } from '../utils/constants';

/**
 * Rate limiting configuration for validation endpoints
 */
const validationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: API_RATE_LIMITS.DEFAULT, // limit each IP to 1000 requests per windowMs
  message: 'Too many validation requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Interface for validation configuration options
 */
interface ValidationConfig {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  rateLimit?: boolean;
  sanitize?: boolean;
}

/**
 * Enhanced validation context for tracking validation metrics
 */
interface ValidationContext {
  startTime: number;
  clientIp: string;
  endpoint: string;
  validationParts: string[];
}

/**
 * Factory function that creates middleware for request validation with enhanced security
 * @param config - Validation configuration for different request parts
 * @returns Express middleware function
 */
export const validateRequest = (config: ValidationConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const context: ValidationContext = {
      startTime: Date.now(),
      clientIp: req.ip,
      endpoint: req.path,
      validationParts: []
    };

    try {
      // Apply rate limiting if enabled
      if (config.rateLimit) {
        await new Promise((resolve, reject) => {
          validationRateLimiter(req, res, (err: Error) => {
            if (err) reject(err);
            resolve(true);
          });
        });
      }

      // Validate and sanitize request body if schema provided
      if (config.body && req.body) {
        context.validationParts.push('body');
        const sanitizedBody = config.sanitize ? sanitizeData(req.body) : req.body;
        req.body = await validateDTO(config.body, sanitizedBody, {
          clientId: context.clientIp,
          context: { part: 'body' }
        });
      }

      // Validate and sanitize query parameters if schema provided
      if (config.query && req.query) {
        context.validationParts.push('query');
        const sanitizedQuery = config.sanitize ? sanitizeData(req.query) : req.query;
        req.query = await validateDTO(config.query, sanitizedQuery, {
          clientId: context.clientIp,
          context: { part: 'query' }
        });
      }

      // Validate and sanitize route parameters if schema provided
      if (config.params && req.params) {
        context.validationParts.push('params');
        const sanitizedParams = config.sanitize ? sanitizeData(req.params) : req.params;
        req.params = await validateDTO(config.params, sanitizedParams, {
          clientId: context.clientIp,
          context: { part: 'params' }
        });
      }

      // Track validation performance
      const validationTime = Date.now() - context.startTime;
      req.validationMetrics = {
        duration: validationTime,
        parts: context.validationParts,
        timestamp: new Date()
      };

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        next(error);
      } else {
        next(new ValidationError('Validation failed', [{
          field: 'global',
          message: error.message,
          code: 'VALIDATION_ERROR'
        }]));
      }
    }
  };
};

/**
 * Factory function for body-specific validation middleware
 * @param schema - Zod schema for request body validation
 * @returns Express middleware function
 */
export const validateBody = (schema: z.ZodSchema) => {
  return validateRequest({ body: schema, sanitize: true });
};

/**
 * Factory function for query parameter validation middleware
 * @param schema - Zod schema for query parameter validation
 * @returns Express middleware function
 */
export const validateQuery = (schema: z.ZodSchema) => {
  return validateRequest({ query: schema, sanitize: true });
};

/**
 * Factory function for route parameter validation middleware
 * @param schema - Zod schema for route parameter validation
 * @returns Express middleware function
 */
export const validateParams = (schema: z.ZodSchema) => {
  return validateRequest({ params: schema, sanitize: true });
};

/**
 * Recursively sanitizes data to prevent XSS attacks
 * @param data - Input data to sanitize
 * @returns Sanitized data
 */
function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    return sanitize(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (data && typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeData(value);
    }
    return sanitized;
  }
  return data;
}

// Extend Express Request interface to include validation metrics
declare global {
  namespace Express {
    interface Request {
      validationMetrics?: {
        duration: number;
        parts: string[];
        timestamp: Date;
      };
    }
  }
}
```

This implementation provides a comprehensive validation middleware with the following features:

1. Rate limiting using express-rate-limit to prevent abuse
2. Input sanitization using xss to prevent XSS attacks
3. Schema validation using Zod with detailed error reporting
4. Performance tracking for validation operations
5. Support for validating request body, query parameters, and route parameters
6. Type-safe implementation with TypeScript
7. Integration with the project's error handling system
8. Recursive data sanitization for nested objects
9. Configurable validation options per endpoint
10. Extended Express Request interface for validation metrics

The middleware can be used in routes like this:
```typescript
router.post('/check', 
  validateBody(createBackgroundCheckSchema),
  validateQuery(paginationSchema),
  checkController.create
);