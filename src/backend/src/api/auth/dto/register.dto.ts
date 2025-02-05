import { z } from 'zod'; // @version ^3.22.0
import { UserRole } from '../../types/user.types';
import { validateEmail, validatePassword } from '../../utils/validators';

/**
 * Constants for registration validation rules
 */
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const TIMEZONE_REGEX = /^[A-Za-z_\/]+$/;

/**
 * Profile information schema with comprehensive validation
 */
const profileSchema = z.object({
  first_name: z.string()
    .min(NAME_MIN_LENGTH, `First name must be at least ${NAME_MIN_LENGTH} characters`)
    .max(NAME_MAX_LENGTH, `First name cannot exceed ${NAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z\s\-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(val => val.trim()),

  last_name: z.string()
    .min(NAME_MIN_LENGTH, `Last name must be at least ${NAME_MIN_LENGTH} characters`)
    .max(NAME_MAX_LENGTH, `Last name cannot exceed ${NAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z\s\-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
    .transform(val => val.trim()),

  phone: z.string()
    .regex(PHONE_REGEX, 'Invalid phone number format. Must follow E.164 format')
    .transform(val => val.replace(/\s+/g, '')),

  timezone: z.string()
    .regex(TIMEZONE_REGEX, 'Invalid timezone format')
    .default('UTC'),

  avatar_url: z.string()
    .url('Invalid avatar URL format')
    .optional(),

  mfa_enabled: z.boolean()
    .default(false),

  mfa_secret: z.string()
    .optional()
}).strict();

/**
 * Comprehensive registration DTO schema with enhanced security validations
 */
export const RegisterDto = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email cannot exceed 255 characters')
    .transform(val => val.toLowerCase().trim())
    .refine(
      async (email) => await validateEmail(email, 'registration'),
      'Invalid email or domain not allowed'
    ),

  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .refine(
      (password) => validatePassword(password).isValid,
      {
        message: 'Password must contain uppercase, lowercase, number, special character and be at least 12 characters long'
      }
    ),

  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: 'Invalid user role' })
  }).refine(
    (role) => [UserRole.COMPANY_ADMIN, UserRole.HR_MANAGER, UserRole.CANDIDATE].includes(role),
    'Selected role is not allowed for registration'
  ),

  organization_id: z.string()
    .uuid('Invalid organization ID format')
    .refine(
      (id) => id.length === 36,
      'Organization ID must be a valid UUID'
    ),

  profile: profileSchema
}).strict();

/**
 * Type definition for registration request data
 */
export type RegisterDtoType = z.infer<typeof RegisterDto>;

/**
 * Type definition for successful registration response
 */
export type RegisterResponseType = {
  id: string;
  email: string;
  role: UserRole;
  organization_id: string;
  profile: z.infer<typeof profileSchema>;
  created_at: Date;
};

/**
 * Validation error response type
 */
export type RegisterValidationError = {
  field: string;
  message: string;
  code: string;
};