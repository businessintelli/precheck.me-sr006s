import { Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import { RedisService } from '../services/cache/redis.service';
import { RateLimitError } from '../utils/errors';
import { API_RATE_LIMITS } from '../utils/constants';

/**
 * Interface for rate limiter configuration options
 */
export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs?: number;
  /** Maximum number of requests allowed within window */
  max?: number;
  /** Custom error message */
  message?: string;
  /** Custom HTTP status code */
  statusCode?: number;
  /** Custom function to generate unique identifier */
  keyGenerator?: (req: Request) => string;
}

/**
 * Default rate limit window (1 hour in milliseconds)
 */
const DEFAULT_WINDOW_MS = 3600000;

/**
 * Default maximum requests per window
 */
const DEFAULT_MAX_REQUESTS = API_RATE_LIMITS.DEFAULT;

/**
 * Redis key prefix for rate limit tracking
 */
const REDIS_KEY_PREFIX = 'ratelimit:';

/**
 * Rate limit response headers
 */
const HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset'
} as const;

/**
 * Factory function that creates a Redis-backed rate limiting middleware
 * @param options Rate limiting configuration options
 * @returns Express middleware function
 */
export const rateLimiter = (options: RateLimitOptions = {}) => {
  const redisService = new RedisService();

  // Merge provided options with defaults
  const opts = {
    windowMs: options.windowMs || DEFAULT_WINDOW_MS,
    max: options.max || DEFAULT_MAX_REQUESTS,
    message: options.message || 'Too many requests, please try again later',
    statusCode: options.statusCode || 429,
    keyGenerator: options.keyGenerator || getClientIdentifier
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get unique client identifier
      const clientId = opts.keyGenerator(req);
      const key = `${REDIS_KEY_PREFIX}${clientId}`;

      // Get current request count from Redis
      const currentRequests = await redisService.get<number>(key) || 0;

      // Check if limit is exceeded
      if (currentRequests >= opts.max) {
        throw new RateLimitError(opts.message, {
          limit: opts.max,
          windowMs: opts.windowMs,
          clientId
        });
      }

      // Increment request count and set expiration
      const newCount = currentRequests + 1;
      await redisService.set(key, newCount, Math.ceil(opts.windowMs / 1000));

      // Calculate reset timestamp
      const resetTime = Math.ceil((Date.now() + opts.windowMs) / 1000);

      // Set rate limit headers
      res.setHeader(HEADERS.LIMIT, opts.max);
      res.setHeader(HEADERS.REMAINING, Math.max(0, opts.max - newCount));
      res.setHeader(HEADERS.RESET, resetTime);

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        res.status(opts.statusCode).json({
          status: 'error',
          message: error.message,
          details: error.details
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * Helper function to extract and validate client identifier from request
 * @param req Express request object
 * @returns Validated client identifier (API key or IP address)
 */
function getClientIdentifier(req: Request): string {
  // Check for API key in header
  const apiKey = req.header('X-API-Key');
  if (apiKey) {
    // Validate API key format
    if (/^[A-Za-z0-9-_]{32,64}$/.test(apiKey)) {
      return `apikey:${apiKey}`;
    }
  }

  // Fall back to IP address
  const forwardedFor = req.header('X-Forwarded-For');
  const clientIp = (forwardedFor ? forwardedFor.split(',')[0] : req.ip).trim();

  // Validate IP address format
  if (!clientIp || !/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[A-F0-9:]+$/i.test(clientIp)) {
    throw new RateLimitError('Invalid client identifier');
  }

  return `ip:${clientIp}`;
}