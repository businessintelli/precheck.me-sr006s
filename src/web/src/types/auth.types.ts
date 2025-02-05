// @package zod ^3.22.0
import { z } from 'zod';
import { User, VALIDATION_CONSTANTS } from './user.types';

/**
 * Interface representing the current authentication state
 * with session management and user context
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
}

/**
 * Interface for login request credentials with validation
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Interface for registration request credentials with enhanced validation
 * and multi-tenant support
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  organizationId: string;
}

/**
 * Interface for authentication response with token management
 * and user context
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Enhanced Zod validation schema for login credentials with
 * comprehensive security checks
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long')
    .regex(VALIDATION_CONSTANTS.EMAIL_REGEX, 'Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long')
    .regex(
      VALIDATION_CONSTANTS.PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, number, and special character'
    )
});

/**
 * Enhanced Zod validation schema for registration credentials
 * with strict validation rules and multi-tenant support
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long')
    .regex(VALIDATION_CONSTANTS.EMAIL_REGEX, 'Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password too long')
    .regex(
      VALIDATION_CONSTANTS.PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  confirmPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  firstName: z
    .string()
    .min(2, 'First name too short')
    .max(50, 'First name too long')
    .regex(/^[a-zA-Z\s-']+$/, 'Invalid characters in first name'),
  lastName: z
    .string()
    .min(2, 'Last name too short')
    .max(50, 'Last name too long')
    .regex(/^[a-zA-Z\s-']+$/, 'Invalid characters in last name'),
  organizationId: z
    .string()
    .uuid('Invalid organization ID format')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

/**
 * Type guard to check if a value is a valid AuthResponse
 */
export const isAuthResponse = (value: unknown): value is AuthResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'user' in value &&
    'accessToken' in value &&
    'refreshToken' in value
  );
};

/**
 * Type guard to check if a value is a valid AuthState
 */
export const isAuthState = (value: unknown): value is AuthState => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isAuthenticated' in value &&
    'user' in value &&
    'accessToken' in value
  );
};