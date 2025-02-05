import { Algorithm } from 'jsonwebtoken'; // @version ^9.0.0
import { RedisConfig } from './redis.config';
import { validateOrganizationDomain } from '../types/organization.types';
import { validatePassword } from '../types/user.types';
import { InternalServerError } from '../utils/errors';

/**
 * Interface for JWT token configuration
 */
interface JWTConfig {
  secret: string;
  algorithm: Algorithm;
  expiresIn: string;
  refreshEnabled: boolean;
  refreshExpiresIn: number;
  issuer: string;
  audience: string;
}

/**
 * Interface for session management configuration
 */
interface SessionConfig {
  ttl: number;
  rolling: boolean;
  name: string;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  domain: string;
}

/**
 * Interface for security settings configuration
 */
interface SecurityConfig {
  mfaEnabled: boolean;
  mfaTokenLength: number;
  mfaTokenValidityWindow: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
  requireStrongPassword: boolean;
  passwordExpiryDays: number;
}

/**
 * JWT configuration with RS256 algorithm for enhanced security
 */
const JWT_CONFIG: JWTConfig = {
  secret: process.env.JWT_SECRET || '',
  algorithm: 'RS256',
  expiresIn: '24h',
  refreshEnabled: true,
  refreshExpiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
  issuer: 'precheck.me',
  audience: 'precheck.me/api'
};

/**
 * Session configuration with secure defaults and Redis backing
 */
const SESSION_CONFIG: SessionConfig = {
  ttl: 24 * 60 * 60, // 24 hours in seconds
  rolling: true,
  name: 'precheck_session',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  domain: '.precheck.me'
};

/**
 * Security configuration with MFA and password policies
 */
const SECURITY_CONFIG: SecurityConfig = {
  mfaEnabled: true,
  mfaTokenLength: 6,
  mfaTokenValidityWindow: 30, // 30 seconds
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60, // 15 minutes in seconds
  requireStrongPassword: true,
  passwordExpiryDays: 90
};

/**
 * Validates the authentication configuration at startup
 * Throws error if configuration is invalid
 */
const validateConfig = (): void => {
  // Verify JWT secret
  if (!JWT_CONFIG.secret || JWT_CONFIG.secret.length < 32) {
    throw new InternalServerError('Invalid JWT secret configuration');
  }

  // Validate JWT algorithm for production
  if (process.env.NODE_ENV === 'production' && JWT_CONFIG.algorithm !== 'RS256') {
    throw new InternalServerError('Production environment requires RS256 algorithm');
  }

  // Check session TTL range
  if (SESSION_CONFIG.ttl < 3600 || SESSION_CONFIG.ttl > 86400) {
    throw new InternalServerError('Session TTL must be between 1 hour and 24 hours');
  }

  // Validate MFA configuration
  if (SECURITY_CONFIG.mfaTokenLength < 6 || SECURITY_CONFIG.mfaTokenLength > 8) {
    throw new InternalServerError('MFA token length must be between 6 and 8 digits');
  }

  if (SECURITY_CONFIG.mfaTokenValidityWindow < 30 || SECURITY_CONFIG.mfaTokenValidityWindow > 60) {
    throw new InternalServerError('MFA validity window must be between 30 and 60 seconds');
  }

  // Validate security settings
  if (SECURITY_CONFIG.lockoutDuration < 900) {
    throw new InternalServerError('Lockout duration must be at least 15 minutes');
  }

  if (SECURITY_CONFIG.passwordExpiryDays < 30 || SECURITY_CONFIG.passwordExpiryDays > 90) {
    throw new InternalServerError('Password expiry must be between 30 and 90 days');
  }

  // Validate session security for production
  if (process.env.NODE_ENV === 'production') {
    if (!SESSION_CONFIG.secure) {
      throw new InternalServerError('Secure session cookies required in production');
    }
    if (SESSION_CONFIG.sameSite !== 'strict') {
      throw new InternalServerError('Strict same-site policy required in production');
    }
  }

  // Validate domain configuration
  if (!validateOrganizationDomain(SESSION_CONFIG.domain.slice(1))) {
    throw new InternalServerError('Invalid session cookie domain configuration');
  }
};

// Export configuration object with all settings
export const authConfig = {
  jwt: JWT_CONFIG,
  session: SESSION_CONFIG,
  security: SECURITY_CONFIG,
  validateConfig
} as const;

// Validate configuration on module load
validateConfig();