// @package zod ^3.22.0
import { z } from 'zod';

/**
 * Enum representing user roles with granular access control
 * @enum {string}
 */
export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  CANDIDATE = 'CANDIDATE'
}

/**
 * Enum representing possible user account statuses
 * @enum {string}
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

/**
 * Constants for validation rules and security patterns
 */
export const VALIDATION_CONSTANTS = {
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/
} as const;

/**
 * Interface for user profile information with i18n support
 */
export interface UserProfile {
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string | null;
  timezone: string;
  locale: string;
}

/**
 * Comprehensive interface for user entity with security features
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organization_id: string;
  profile: UserProfile;
  last_login: Date;
  mfa_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Zod schema for email validation with enhanced security
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .regex(VALIDATION_CONSTANTS.EMAIL_REGEX, 'Email format is invalid')
  .min(5, 'Email is too short')
  .max(254, 'Email exceeds maximum length')
  .refine((email) => !email.includes('admin'), 'Email cannot contain restricted words');

/**
 * Zod schema for password validation with strict security requirements
 */
export const passwordSchema = z
  .string()
  .min(VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH, `Password must be at least ${VALIDATION_CONSTANTS.PASSWORD_MIN_LENGTH} characters`)
  .regex(
    VALIDATION_CONSTANTS.PASSWORD_REGEX,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  )
  .max(128, 'Password exceeds maximum length');

/**
 * Zod schema for phone number validation
 */
export const phoneSchema = z
  .string()
  .regex(VALIDATION_CONSTANTS.PHONE_REGEX, 'Invalid phone number format')
  .min(8, 'Phone number is too short')
  .max(15, 'Phone number is too long');

/**
 * Zod schema for UserProfile validation
 */
export const userProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50, 'First name is too long'),
  last_name: z.string().min(1, 'Last name is required').max(50, 'Last name is too long'),
  phone: phoneSchema,
  avatar_url: z.string().url().nullable(),
  timezone: z.string().min(1, 'Timezone is required'),
  locale: z.string().min(2, 'Locale is required').max(5, 'Invalid locale format')
});

/**
 * Zod schema for complete User validation
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  organization_id: z.string().uuid(),
  profile: userProfileSchema,
  last_login: z.date(),
  mfa_enabled: z.boolean(),
  created_at: z.date(),
  updated_at: z.date()
});

/**
 * Type guard to check if a value is a valid UserRole
 */
export const isUserRole = (value: unknown): value is UserRole => {
  return Object.values(UserRole).includes(value as UserRole);
};

/**
 * Type guard to check if a value is a valid UserStatus
 */
export const isUserStatus = (value: unknown): value is UserStatus => {
  return Object.values(UserStatus).includes(value as UserStatus);
};

/**
 * Helper function for email validation with enhanced security checks
 */
export const validateEmail = (email: string): boolean => {
  try {
    emailSchema.parse(email);
    return true;
  } catch {
    return false;
  }
};

/**
 * Helper function for password validation with comprehensive security checks
 */
export const validatePassword = (password: string): boolean => {
  try {
    passwordSchema.parse(password);
    return true;
  } catch {
    return false;
  }
};

/**
 * Type for user creation payload with required fields
 */
export type CreateUserPayload = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login'>;

/**
 * Type for user update payload with optional fields
 */
export type UpdateUserPayload = Partial<Omit<User, 'id' | 'email' | 'created_at' | 'updated_at'>>;

/**
 * Type for user authentication response
 */
export type AuthResponse = {
  user: User;
  token: string;
  mfa_required: boolean;
};