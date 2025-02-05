import { z } from 'zod'; // @version ^3.22.0
import { i18next } from 'i18next'; // @version ^23.0.0
import { RateLimiter } from 'rate-limiter-flexible'; // @version ^2.4.1
import { validateEmail, validatePassword } from '../../../utils/validators';
import { ValidationError } from '../../../utils/errors';

/**
 * Constants for login validation and rate limiting
 */
const LOGIN_ERROR_MESSAGES = {
  INVALID_EMAIL: 'auth:errors.email.invalid',
  DISPOSABLE_EMAIL: 'auth:errors.email.disposable',
  INVALID_DOMAIN: 'auth:errors.email.domain',
  INVALID_PASSWORD: 'auth:errors.password.requirements',
  PASSWORD_BREACHED: 'auth:errors.password.breached',
  RATE_LIMIT_EXCEEDED: 'auth:errors.rateLimit.exceeded',
  SUSPICIOUS_ACTIVITY: 'auth:errors.security.suspicious'
} as const;

/**
 * Configuration for login validation and security
 */
const VALIDATION_CONFIG = {
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_MAX_LENGTH: 128,
  RATE_LIMIT_WINDOW: 3600,
  RATE_LIMIT_MAX_ATTEMPTS: 5
} as const;

/**
 * Rate limiter instance for login attempts
 */
const loginRateLimiter = new RateLimiter({
  points: VALIDATION_CONFIG.RATE_LIMIT_MAX_ATTEMPTS,
  duration: VALIDATION_CONFIG.RATE_LIMIT_WINDOW,
  blockDuration: VALIDATION_CONFIG.RATE_LIMIT_WINDOW
});

/**
 * Login DTO schema with comprehensive validation rules
 */
export const LoginDto = z.object({
  email: z.string()
    .min(1, { message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_EMAIL) })
    .max(255, { message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_EMAIL) })
    .email({ message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_EMAIL) })
    .refine(async (email) => await validateEmail(email, 'login'), {
      message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_EMAIL)
    }),

  password: z.string()
    .min(VALIDATION_CONFIG.PASSWORD_MIN_LENGTH, {
      message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_PASSWORD)
    })
    .max(VALIDATION_CONFIG.PASSWORD_MAX_LENGTH, {
      message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_PASSWORD)
    })
    .refine(async (password) => {
      const validation = await validatePassword(password);
      return validation.isValid;
    }, {
      message: i18next.t(LOGIN_ERROR_MESSAGES.INVALID_PASSWORD)
    }),

  fingerprint: z.string()
    .min(1, { message: 'Device fingerprint is required' })
    .max(512, { message: 'Invalid fingerprint length' })
    .refine((fp) => /^[a-zA-Z0-9-_]+$/.test(fp), {
      message: 'Invalid fingerprint format'
    })
}).strict();

/**
 * Type definition for validated login data
 */
export type ValidatedLoginData = z.infer<typeof LoginDto>;

/**
 * Validates login credentials with enhanced security checks and rate limiting
 * @param loginData - Login credentials to validate
 * @param requestContext - Request context for security checks
 * @returns Promise resolving to validated login data
 * @throws ValidationError if validation fails or rate limit exceeded
 */
export async function validateLoginDto(
  loginData: unknown,
  requestContext: { ip: string; fingerprint: string }
): Promise<ValidatedLoginData> {
  try {
    // Check rate limiting
    const rateLimitKey = `${requestContext.ip}:${requestContext.fingerprint}`;
    await loginRateLimiter.consume(rateLimitKey);

    // Sanitize and normalize input data
    const sanitizedData = {
      ...loginData,
      email: typeof loginData?.['email'] === 'string' 
        ? loginData['email'].toLowerCase().trim()
        : '',
      fingerprint: requestContext.fingerprint
    };

    // Parse and validate using schema
    const validatedData = await LoginDto.parseAsync(sanitizedData);

    return validatedData;
  } catch (error) {
    if (error.name === 'RateLimiterError') {
      throw new ValidationError(
        i18next.t(LOGIN_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED),
        [{
          field: 'global',
          message: i18next.t(LOGIN_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED),
          code: 'RATE_LIMIT_EXCEEDED'
        }]
      );
    }

    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: 'VALIDATION_ERROR'
      }));
      throw new ValidationError('Login validation failed', validationErrors);
    }

    throw error;
  }
}