// @package zod version ^3.22.0
import { z } from 'zod';
import { Organization } from './organization.types';

/**
 * Enum defining comprehensive user roles with distinct permission levels
 */
export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  CANDIDATE = 'CANDIDATE'
}

/**
 * Enum defining possible user account statuses with security implications
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

/**
 * Constants for security configuration
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const MAX_LOGIN_ATTEMPTS = 5;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Interface for extended user profile information including MFA settings
 */
export interface UserProfile {
  first_name: string;
  last_name: string;
  phone: string;
  avatar_url: string;
  timezone: string;
  mfa_enabled: boolean;
  mfa_secret?: string;
}

/**
 * Comprehensive interface for user entity with security and audit fields
 */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  organization_id: string;
  profile: UserProfile;
  last_login: Date;
  failed_login_attempts: number;
  password_changed_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Zod schema for email validation with comprehensive rules
 */
export const emailSchema = z.string()
  .email('Invalid email format')
  .regex(EMAIL_REGEX, 'Email must be in a valid format')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email cannot exceed 255 characters');

/**
 * Zod schema for password validation with security requirements
 */
export const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters`)
  .regex(PASSWORD_REGEX, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');

/**
 * Zod schema for user profile validation
 */
export const userProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  avatar_url: z.string().url().optional(),
  timezone: z.string().regex(/^[A-Za-z_\/]+$/, 'Invalid timezone format'),
  mfa_enabled: z.boolean(),
  mfa_secret: z.string().optional()
});

/**
 * Comprehensive Zod schema for user validation
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: emailSchema,
  password_hash: z.string(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  organization_id: z.string().uuid(),
  profile: userProfileSchema,
  last_login: z.date(),
  failed_login_attempts: z.number().min(0).max(MAX_LOGIN_ATTEMPTS),
  password_changed_at: z.date(),
  created_at: z.date(),
  updated_at: z.date()
});

/**
 * Validates email format and domain with comprehensive rules
 * @param email - Email to validate
 * @returns boolean indicating if email is valid and meets all requirements
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
 * Validates password against security requirements
 * @param password - Password to validate
 * @returns boolean indicating if password meets all security requirements
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
 * Type guard to check if a value is a valid UserRole
 */
export const isUserRole = (value: any): value is UserRole => {
  return Object.values(UserRole).includes(value as UserRole);
};

/**
 * Type guard to check if a value is a valid UserStatus
 */
export const isUserStatus = (value: any): value is UserStatus => {
  return Object.values(UserStatus).includes(value as UserStatus);
};