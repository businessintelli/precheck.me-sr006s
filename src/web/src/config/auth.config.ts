// @package zod ^3.22.0
import { z } from 'zod';
import { AuthState } from '../types/auth.types';

/**
 * Enhanced token management configuration interface
 */
interface TokenConfig {
  accessTokenKey: string;
  refreshTokenKey: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  enableTokenRotation: boolean;
  rotationThreshold: number;
  tokenEncryptionKey: string;
  enableSlidingSession: boolean;
}

/**
 * Enhanced security configuration interface
 */
interface SecurityConfig {
  mfaEnabled: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number;
  progressiveDelayBase: number;
  allowedOrigins: string[];
  enableCSRF: boolean;
  csrfTokenKey: string;
  enableIPBlocking: boolean;
  ipBlockDuration: number;
}

/**
 * Rate limiting configuration interface
 */
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  enableProgressiveThrottling: boolean;
  throttlingMultiplier: number;
}

/**
 * Multi-tenant organization configuration interface
 */
interface OrganizationConfig {
  enableMultiTenant: boolean;
  orgIdHeader: string;
  requireOrgContext: boolean;
  allowedDomains: string[];
}

/**
 * Comprehensive authentication configuration interface
 */
interface AuthConfig {
  apiUrl: string;
  loginEndpoint: string;
  registerEndpoint: string;
  logoutEndpoint: string;
  refreshTokenEndpoint: string;
  mfaEndpoint: string;
  tokenConfig: TokenConfig;
  securityConfig: SecurityConfig;
  rateLimitConfig: RateLimitConfig;
  organizationConfig: OrganizationConfig;
}

/**
 * Zod schema for token configuration validation
 */
const tokenConfigSchema = z.object({
  accessTokenKey: z.string().min(1),
  refreshTokenKey: z.string().min(1),
  accessTokenExpiry: z.number().positive().max(86400), // Max 24 hours
  refreshTokenExpiry: z.number().positive().max(2592000), // Max 30 days
  enableTokenRotation: z.boolean(),
  rotationThreshold: z.number().positive().max(3600), // Max 1 hour
  tokenEncryptionKey: z.string().min(32),
  enableSlidingSession: z.boolean()
});

/**
 * Zod schema for security configuration validation
 */
const securityConfigSchema = z.object({
  mfaEnabled: z.boolean(),
  maxLoginAttempts: z.number().int().positive().max(10),
  lockoutDuration: z.number().positive().max(7200), // Max 2 hours
  progressiveDelayBase: z.number().positive().max(10),
  allowedOrigins: z.array(z.string().url()),
  enableCSRF: z.boolean(),
  csrfTokenKey: z.string().min(1),
  enableIPBlocking: z.boolean(),
  ipBlockDuration: z.number().positive().max(86400) // Max 24 hours
});

/**
 * Zod schema for rate limit configuration validation
 */
const rateLimitConfigSchema = z.object({
  maxRequestsPerMinute: z.number().int().positive().max(1000),
  maxRequestsPerHour: z.number().int().positive().max(10000),
  enableProgressiveThrottling: z.boolean(),
  throttlingMultiplier: z.number().positive().max(10)
});

/**
 * Zod schema for organization configuration validation
 */
const organizationConfigSchema = z.object({
  enableMultiTenant: z.boolean(),
  orgIdHeader: z.string().min(1),
  requireOrgContext: z.boolean(),
  allowedDomains: z.array(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/))
});

/**
 * Comprehensive Zod schema for complete auth configuration
 */
const authConfigSchema = z.object({
  apiUrl: z.string().url(),
  loginEndpoint: z.string().startsWith('/'),
  registerEndpoint: z.string().startsWith('/'),
  logoutEndpoint: z.string().startsWith('/'),
  refreshTokenEndpoint: z.string().startsWith('/'),
  mfaEndpoint: z.string().startsWith('/'),
  tokenConfig: tokenConfigSchema,
  securityConfig: securityConfigSchema,
  rateLimitConfig: rateLimitConfigSchema,
  organizationConfig: organizationConfigSchema
});

/**
 * Production authentication configuration
 */
export const AUTH_CONFIG: AuthConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
  loginEndpoint: '/auth/login',
  registerEndpoint: '/auth/register',
  logoutEndpoint: '/auth/logout',
  refreshTokenEndpoint: '/auth/refresh',
  mfaEndpoint: '/auth/mfa',
  tokenConfig: {
    accessTokenKey: 'access_token',
    refreshTokenKey: 'refresh_token',
    accessTokenExpiry: 3600, // 1 hour
    refreshTokenExpiry: 604800, // 1 week
    enableTokenRotation: true,
    rotationThreshold: 300, // 5 minutes
    tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY!,
    enableSlidingSession: true
  },
  securityConfig: {
    mfaEnabled: true,
    maxLoginAttempts: 5,
    lockoutDuration: 900, // 15 minutes
    progressiveDelayBase: 2,
    allowedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
    enableCSRF: true,
    csrfTokenKey: 'csrf_token',
    enableIPBlocking: true,
    ipBlockDuration: 3600 // 1 hour
  },
  rateLimitConfig: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    enableProgressiveThrottling: true,
    throttlingMultiplier: 1.5
  },
  organizationConfig: {
    enableMultiTenant: true,
    orgIdHeader: 'X-Organization-ID',
    requireOrgContext: true,
    allowedDomains: []
  }
};

/**
 * Validates the complete authentication configuration at startup
 * Throws error if configuration is invalid
 */
export function validateConfig(): void {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_API_URL) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
    }
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
      throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      throw new Error('NEXT_PUBLIC_APP_URL environment variable is required');
    }

    // Validate complete configuration
    authConfigSchema.parse(AUTH_CONFIG);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Authentication configuration validation failed:', error.errors);
    }
    throw error;
  }
}

// Export validated configuration
export const authConfig = {
  apiUrl: AUTH_CONFIG.apiUrl,
  endpoints: {
    login: AUTH_CONFIG.loginEndpoint,
    register: AUTH_CONFIG.registerEndpoint,
    logout: AUTH_CONFIG.logoutEndpoint,
    refresh: AUTH_CONFIG.refreshTokenEndpoint,
    mfa: AUTH_CONFIG.mfaEndpoint
  },
  tokenConfig: AUTH_CONFIG.tokenConfig,
  securityConfig: AUTH_CONFIG.securityConfig,
  rateLimitConfig: AUTH_CONFIG.rateLimitConfig,
  organizationConfig: AUTH_CONFIG.organizationConfig
};