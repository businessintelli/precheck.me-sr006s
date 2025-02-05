/**
 * Production-ready Axios instance configuration for Precheck.me API
 * @package @precheck/web
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.6.0
import axiosRetry from 'axios-retry'; // ^4.0.0
import rateLimit from 'axios-rate-limit'; // ^1.3.0
import { API_CONFIG } from '../config/api.config';
import { v4 as uuidv4 } from 'uuid';

// Constants for HTTP client configuration
const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'X-Request-ID': '',
  'X-Client-Version': API_CONFIG.version
};

const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection and try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again to continue.',
  FORBIDDEN: "You don't have permission to access this resource. Please contact support if you believe this is an error.",
  RATE_LIMITED: 'Too many requests. Please wait {{retryAfter}} seconds before trying again.',
  SERVER_ERROR: 'An unexpected error occurred on our servers. Our team has been notified and is working on it.',
  VALIDATION_ERROR: 'The submitted data is invalid. Please check your input and try again.',
  TIMEOUT_ERROR: 'The request timed out. Please try again.'
} as const;

// Create base axios instance
const axiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  withCredentials: true,
  headers: DEFAULT_HEADERS
});

// Configure retry logic
axiosRetry(axiosInstance, {
  retries: API_CONFIG.retryConfig.retries,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    return API_CONFIG.retryConfig.retryCondition.includes(error.code || '');
  },
  shouldResetTimeout: API_CONFIG.retryConfig.shouldResetTimeout,
  onRetry: (retryCount, error, requestConfig) => {
    if (API_CONFIG.debug) {
      console.warn(`Retry attempt ${retryCount} for request:`, {
        url: requestConfig.url,
        error: error.message
      });
    }
  }
});

// Apply rate limiting
const rateLimitedInstance = rateLimit(axiosInstance, {
  maxRequests: API_CONFIG.rateLimit.maxRequests,
  perMilliseconds: API_CONFIG.rateLimit.perHour * 1000,
  maxRPS: API_CONFIG.rateLimit.burstLimit
});

/**
 * Handles authentication token refresh when original token expires
 * @param refreshToken - Current refresh token
 * @returns Promise with new access token
 */
const refreshAuthToken = async (refreshToken: string): Promise<string> => {
  try {
    const response = await axiosInstance.post('/auth/refresh', { refreshToken });
    return response.data.accessToken;
  } catch (error) {
    throw new Error('Unable to refresh authentication token');
  }
};

/**
 * Advanced error handling with specific error types and user-friendly messages
 * @param error - Axios error object
 */
const handleRequestError = async (error: AxiosError): Promise<never> => {
  const errorResponse = {
    message: '',
    code: error.code || 'UNKNOWN_ERROR',
    status: error.response?.status || 500,
    details: error.response?.data || {}
  };

  switch (error.response?.status) {
    case 401:
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const newToken = await refreshAuthToken(refreshToken);
          localStorage.setItem('accessToken', newToken);
          return axiosInstance.request(error.config as AxiosRequestConfig);
        } catch (refreshError) {
          errorResponse.message = ERROR_MESSAGES.UNAUTHORIZED;
          // Trigger logout or authentication flow
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
      break;
    case 403:
      errorResponse.message = ERROR_MESSAGES.FORBIDDEN;
      break;
    case 429:
      const retryAfter = error.response.headers['retry-after'] || 60;
      errorResponse.message = ERROR_MESSAGES.RATE_LIMITED.replace(
        '{{retryAfter}}',
        retryAfter
      );
      break;
    case 408:
    case 504:
      errorResponse.message = ERROR_MESSAGES.TIMEOUT_ERROR;
      break;
    case 500:
    case 502:
    case 503:
      errorResponse.message = ERROR_MESSAGES.SERVER_ERROR;
      break;
    default:
      errorResponse.message = error.message || ERROR_MESSAGES.NETWORK_ERROR;
  }

  if (API_CONFIG.debug) {
    console.error('API Request Failed:', {
      config: error.config,
      response: error.response,
      error: errorResponse
    });
  }

  throw errorResponse;
};

/**
 * Configures request and response interceptors for authentication and error handling
 * @param instance - Axios instance to configure
 */
const setupInterceptors = (instance: AxiosInstance): void => {
  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      // Add request ID for tracking
      config.headers['X-Request-ID'] = uuidv4();
      
      // Add authentication token if available
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Add CSRF token if available
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      // Log successful requests in debug mode
      if (API_CONFIG.debug) {
        console.debug('API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data
        });
      }
      return response;
    },
    handleRequestError
  );
};

// Apply interceptors to rate-limited instance
setupInterceptors(rateLimitedInstance);

// Export configured instance
export default rateLimitedInstance;

// Export type definitions for consumers
export type { AxiosInstance, AxiosError, AxiosRequestConfig };