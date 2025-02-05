import { z } from 'zod'; // @version ^3.22.0
import sanitizeHtml from 'sanitize-html'; // @version ^2.11.0
import { RateLimiter } from 'rate-limiter-flexible'; // @version ^2.4.1
import { ValidationError } from './errors';

// Regular expressions for common validation patterns
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Rate limiting configuration
const VALIDATION_RATE_LIMIT = 100; // Maximum validations per window
const VALIDATION_WINDOW = 3600; // Time window in seconds (1 hour)

// Initialize rate limiter
const rateLimiter = new RateLimiter({
  points: VALIDATION_RATE_LIMIT,
  duration: VALIDATION_WINDOW,
  blockDuration: VALIDATION_WINDOW
});

/**
 * Enhanced email validation with security checks and rate limiting
 * @param email - Email address to validate
 * @param clientId - Unique identifier for rate limiting
 * @returns Promise resolving to boolean indicating validity
 */
export async function validateEmail(email: string, clientId: string): Promise<boolean> {
  try {
    // Check rate limit
    await rateLimiter.consume(clientId);

    // Basic sanitization
    const sanitizedEmail = sanitizeHtml(email, {
      allowedTags: [],
      allowedAttributes: {}
    }).trim();

    // Length check
    if (sanitizedEmail.length > 254) {
      return false;
    }

    // Regex validation
    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      return false;
    }

    // Domain validation
    const [, domain] = sanitizedEmail.split('@');
    try {
      const hasMx = await new Promise((resolve) => {
        require('dns').resolveMx(domain, (err: Error, addresses: any[]) => {
          resolve(!err && addresses && addresses.length > 0);
        });
      });
      return !!hasMx;
    } catch {
      return false;
    }
  } catch (error) {
    if (error.name === 'RateLimiterError') {
      throw new ValidationError('Rate limit exceeded for email validation', [
        { field: 'email', message: 'Too many validation attempts', code: 'RATE_LIMIT_EXCEEDED' }
      ]);
    }
    return false;
  }
}

/**
 * Enhanced password validation with comprehensive strength requirements
 * @param password - Password to validate
 * @returns Validation result with detailed requirements status
 */
export function validatePassword(password: string): {
  isValid: boolean;
  score: number;
  requirements: Record<string, boolean>;
} {
  const requirements = {
    length: password.length >= 12 && password.length <= 128,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
    pattern: PASSWORD_REGEX.test(password)
  };

  // Check against common password list
  const commonPasswords = ['Password123!', 'Admin123!', 'Welcome123!']; // Abbreviated list
  const isCommon = commonPasswords.includes(password);

  // Calculate strength score (0-100)
  const score = Object.values(requirements).filter(Boolean).length * 20 - (isCommon ? 50 : 0);

  return {
    isValid: PASSWORD_REGEX.test(password) && !isCommon,
    score: Math.max(0, Math.min(100, score)),
    requirements
  };
}

/**
 * UUID format validation with version checking
 * @param uuid - UUID string to validate
 * @param version - Optional UUID version to check
 * @returns Boolean indicating if UUID is valid
 */
export function validateUUID(uuid: string, version?: number): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const isValidFormat = UUID_REGEX.test(uuid);
  if (!isValidFormat) {
    return false;
  }

  if (version !== undefined) {
    const uuidVersion = parseInt(uuid.charAt(14), 16);
    return uuidVersion === version;
  }

  return true;
}

/**
 * Enhanced DTO validation using Zod schema with detailed error reporting
 * @param schema - Zod schema for validation
 * @param data - Data to validate
 * @param options - Validation options
 * @returns Promise resolving to validated and parsed data
 */
export async function validateDTO<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: {
    rateLimit?: boolean;
    clientId?: string;
    context?: Record<string, unknown>;
  } = {}
): Promise<T> {
  try {
    // Apply rate limiting if enabled
    if (options.rateLimit && options.clientId) {
      await rateLimiter.consume(options.clientId);
    }

    // Sanitize input data recursively
    const sanitizedData = JSON.parse(JSON.stringify(data, (_, value) => {
      if (typeof value === 'string') {
        return sanitizeHtml(value, {
          allowedTags: [],
          allowedAttributes: {}
        }).trim();
      }
      return value;
    }));

    // Custom error map for detailed validation errors
    const result = await schema.safeParseAsync(sanitizedData, {
      errorMap: (error, ctx) => ({
        message: ctx.defaultError,
        path: error.path,
        code: error.code,
        context: options.context
      })
    });

    if (!result.success) {
      const validationErrors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      throw new ValidationError('Validation failed', validationErrors);
    }

    return result.data;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (error.name === 'RateLimiterError') {
      throw new ValidationError('Rate limit exceeded for validation', [
        { field: 'global', message: 'Too many validation attempts', code: 'RATE_LIMIT_EXCEEDED' }
      ]);
    }
    throw new ValidationError('Validation error occurred', [
      { field: 'global', message: error.message, code: 'VALIDATION_ERROR' }
    ]);
  }
}