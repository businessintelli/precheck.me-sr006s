import { Request, Response, NextFunction } from 'express'; // @version ^4.18.0
import jwt from 'jsonwebtoken'; // @version ^9.0.0
import winston from 'winston'; // @version ^3.8.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // @version ^2.4.1
import { authConfig } from '../../../config/auth.config';
import { UnauthorizedError, ForbiddenError } from '../../../utils/errors';
import { secureLogger } from '../../../utils/logger';
import { UserRole } from '../../../types/user.types';

// Constants for token handling and security
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer ';
const COOKIE_NAME = 'jwt_token';
const MIN_TOKEN_LENGTH = 128;
const MAX_TOKEN_LENGTH = 4096;
const TOKEN_GRACE_PERIOD = 300; // 5 minutes in seconds
const MAX_AUTH_ATTEMPTS = 5;

/**
 * Extended Express Request interface with authenticated user and security context
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    organizationId: string;
    permissions: string[];
  };
  correlationId: string;
  securityContext: {
    tokenId: string;
    issuedAt: number;
    expiresAt: number;
    clientIp: string;
    userAgent: string;
  };
}

/**
 * Enhanced JWT payload interface with security claims
 */
interface JWTPayload {
  userId: string;
  role: UserRole;
  permissions: string[];
  tenantId: string;
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Rate limiter configuration for authentication attempts
 */
const rateLimiter = new RateLimiterRedis({
  storeClient: authConfig.redis,
  keyPrefix: 'jwt_auth_limit',
  points: MAX_AUTH_ATTEMPTS,
  duration: 3600, // 1 hour
  blockDuration: 1800 // 30 minutes
});

/**
 * Securely extracts JWT token from request
 */
const extractToken = (req: Request): string | null => {
  try {
    // Check Authorization header
    const authHeader = req.headers[TOKEN_HEADER.toLowerCase()];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith(TOKEN_PREFIX)) {
      const token = authHeader.slice(TOKEN_PREFIX.length);
      if (token.length >= MIN_TOKEN_LENGTH && token.length <= MAX_TOKEN_LENGTH) {
        return token;
      }
    }

    // Check secure cookie as fallback
    const cookieToken = req.cookies[COOKIE_NAME];
    if (cookieToken && typeof cookieToken === 'string' &&
        cookieToken.length >= MIN_TOKEN_LENGTH && cookieToken.length <= MAX_TOKEN_LENGTH) {
      return cookieToken;
    }

    return null;
  } catch (error) {
    secureLogger.error('Token extraction failed', { error });
    return null;
  }
};

/**
 * Comprehensive JWT verification with RS256 signing
 */
const verifyJWT = async (token: string, correlationId: string): Promise<JWTPayload> => {
  try {
    // Verify token signature and claims
    const decoded = jwt.verify(token, authConfig.jwt.secret, {
      algorithms: ['RS256'],
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
      clockTolerance: TOKEN_GRACE_PERIOD
    }) as JWTPayload;

    // Validate required claims
    if (!decoded.userId || !decoded.role || !decoded.jti) {
      throw new UnauthorizedError('Invalid token claims');
    }

    // Log verification success
    secureLogger.info('JWT verified successfully', {
      userId: decoded.userId,
      tokenId: decoded.jti,
      correlationId
    });

    return decoded;
  } catch (error) {
    secureLogger.error('JWT verification failed', {
      error,
      correlationId
    });
    throw new UnauthorizedError('Invalid or expired token');
  }
};

/**
 * Secure JWT authentication middleware with RBAC
 */
export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();
  req.correlationId = correlationId;

  try {
    // Check rate limiting
    await rateLimiter.consume(req.ip);

    // Extract and validate token
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('No valid token provided');
    }

    // Verify token and extract payload
    const payload = await verifyJWT(token, correlationId);

    // Set authenticated user and security context
    req.user = {
      id: payload.userId,
      role: payload.role,
      organizationId: payload.tenantId,
      permissions: payload.permissions
    };

    req.securityContext = {
      tokenId: payload.jti,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    // Log successful authentication
    secureLogger.logSecurityEvent({
      type: 'AUTHENTICATION_SUCCESS',
      severity: 'INFO',
      details: {
        userId: payload.userId,
        role: payload.role,
        tokenId: payload.jti,
        correlationId
      },
      userId: payload.userId,
      organizationId: payload.tenantId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    next();
  } catch (error) {
    // Handle rate limiting errors
    if (error.name === 'RateLimiterError') {
      throw new ForbiddenError('Too many authentication attempts', {
        retryAfter: error.msBeforeNext / 1000
      });
    }

    // Log authentication failure
    secureLogger.logSecurityEvent({
      type: 'AUTHENTICATION_FAILURE',
      severity: 'WARNING',
      details: {
        error: error.message,
        correlationId
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    next(error);
  }
};

export default authenticateJWT;