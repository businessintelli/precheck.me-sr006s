/**
 * API Configuration for Precheck.me Web Application
 * @version 1.0.0
 * @package @precheck/web
 */

// Interfaces
interface ApiConfig {
  baseURL: string;
  version: string;
  timeout: number;
  retryConfig: RetryConfig;
  rateLimit: RateLimitConfig;
  security: SecurityConfig;
  debug: boolean;
}

interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: string[];
  shouldResetTimeout: boolean;
  backoffFactor: number;
  maxRetryDelay: number;
}

interface RateLimitConfig {
  maxRequests: number;
  perHour: number;
  burstLimit: number;
  perClientTracking: boolean;
}

interface SecurityConfig {
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    maxAge: number;
  };
  headers: Record<string, string>;
}

// Constants
const API_VERSION = 'v1';

const BASE_URL = {
  development: 'http://localhost:3000/api',
  staging: 'https://staging-api.precheck.me/api',
  production: 'https://api.precheck.me/api'
} as const;

const REQUEST_TIMEOUT = 30000; // 30 seconds

const RETRY_CONFIG: RetryConfig = {
  retries: 3,
  retryDelay: 1000,
  retryCondition: [
    'ECONNABORTED',
    'ETIMEDOUT',
    'NETWORK_ERROR',
    'RATE_LIMIT_EXCEEDED',
    'SERVER_ERROR'
  ],
  shouldResetTimeout: true,
  backoffFactor: 2,
  maxRetryDelay: 10000
};

const RATE_LIMIT: RateLimitConfig = {
  maxRequests: 1000,
  perHour: 3600,
  burstLimit: 50,
  perClientTracking: true
};

const SECURITY_CONFIG: SecurityConfig = {
  cors: {
    allowedOrigins: ['https://*.precheck.me'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  },
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
};

// Utility Functions
const getBaseUrl = (): string => {
  const environment = process.env.NODE_ENV || 'development';
  
  if (!Object.keys(BASE_URL).includes(environment)) {
    console.warn(`Invalid environment: ${environment}, defaulting to development`);
    return BASE_URL.development;
  }

  return BASE_URL[environment as keyof typeof BASE_URL];
};

const validateConfig = (config: ApiConfig): boolean => {
  try {
    // Validate base URL
    new URL(config.baseURL);

    // Validate version format
    if (!/^v\d+$/.test(config.version)) {
      throw new Error('Invalid API version format');
    }

    // Validate timeout
    if (config.timeout < 1000 || config.timeout > 60000) {
      throw new Error('Timeout must be between 1000 and 60000 ms');
    }

    // Validate retry config
    if (
      config.retryConfig.retries < 0 ||
      config.retryConfig.retryDelay < 0 ||
      config.retryConfig.maxRetryDelay < config.retryConfig.retryDelay
    ) {
      throw new Error('Invalid retry configuration');
    }

    // Validate rate limit
    if (
      config.rateLimit.maxRequests < 1 ||
      config.rateLimit.perHour < 1 ||
      config.rateLimit.burstLimit > config.rateLimit.maxRequests
    ) {
      throw new Error('Invalid rate limit configuration');
    }

    return true;
  } catch (error) {
    if (config.debug) {
      console.error('API Config validation failed:', error);
    }
    return false;
  }
};

// Main Configuration Export
export const API_CONFIG: ApiConfig = {
  baseURL: getBaseUrl(),
  version: API_VERSION,
  timeout: REQUEST_TIMEOUT,
  retryConfig: RETRY_CONFIG,
  rateLimit: RATE_LIMIT,
  security: SECURITY_CONFIG,
  debug: process.env.NODE_ENV !== 'production'
};

// Validate configuration on initialization
if (!validateConfig(API_CONFIG)) {
  throw new Error('Invalid API configuration');
}

// Type exports for consumers
export type {
  ApiConfig,
  RetryConfig,
  RateLimitConfig,
  SecurityConfig
};