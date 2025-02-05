// @package zod version ^3.22.0
import { z } from 'zod';
import { UserRole, emailSchema, passwordSchema, userProfileSchema } from '../../types/user.types';

/**
 * Enhanced Zod schema for user creation with comprehensive validation rules
 * Implements strict security measures and data integrity checks
 */
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.nativeEnum(UserRole)
    .refine(
      (role) => role !== UserRole.SYSTEM_ADMIN,
      'System admin role cannot be assigned through regular user creation'
    ),
  organization_id: z.string()
    .uuid('Organization ID must be a valid UUID')
    .min(1, 'Organization ID is required'),
  profile: userProfileSchema
    .extend({
      first_name: z.string()
        .min(1, 'First name is required')
        .max(100, 'First name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s-']+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
        .transform(str => str.trim()),
      
      last_name: z.string()
        .min(1, 'Last name is required')
        .max(100, 'Last name cannot exceed 100 characters')
        .regex(/^[a-zA-Z\s-']+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
        .transform(str => str.trim()),
      
      phone: z.string()
        .regex(
          /^\+[1-9]\d{1,14}$/,
          'Phone number must be in E.164 format (e.g., +1234567890)'
        ),
      
      avatar_url: z.string()
        .url('Avatar URL must be a valid URL')
        .regex(
          /\.(jpg|jpeg|png|webp)$/i,
          'Avatar URL must point to a valid image file (jpg, jpeg, png, webp)'
        )
        .optional(),
      
      timezone: z.string()
        .regex(
          /^[A-Za-z_\/]+$/,
          'Timezone must be in IANA format (e.g., America/New_York)'
        )
    })
    .strict()
}).strict();

/**
 * Type inference from the Zod schema for type-safe user creation payload
 */
export type CreateUserDto = z.infer<typeof createUserSchema>;

/**
 * Validates and sanitizes user creation data against the schema
 * @param data - Raw user creation data
 * @returns Validated and sanitized CreateUserDto
 * @throws ZodError if validation fails
 */
export const validateCreateUserDto = (data: unknown): CreateUserDto => {
  return createUserSchema.parse(data);
};

/**
 * Partial schema for user creation without password
 * Useful for social auth and SSO flows
 */
export const createUserWithoutPasswordSchema = createUserSchema.omit({ 
  password: true 
}).strict();

/**
 * Type inference for user creation without password
 */
export type CreateUserWithoutPasswordDto = z.infer<typeof createUserWithoutPasswordSchema>;

/**
 * Role-specific validation refinements
 */
export const roleValidationRules = {
  [UserRole.COMPANY_ADMIN]: createUserSchema.refine(
    (data) => data.organization_id !== undefined,
    'Company admin requires a valid organization ID'
  ),
  [UserRole.HR_MANAGER]: createUserSchema.refine(
    (data) => data.organization_id !== undefined,
    'HR manager requires a valid organization ID'
  ),
  [UserRole.CANDIDATE]: createUserSchema
};

/**
 * Validates user creation data with role-specific rules
 * @param data - Raw user creation data
 * @param role - User role for specific validation rules
 * @returns Validated and sanitized CreateUserDto
 * @throws ZodError if validation fails
 */
export const validateCreateUserDtoWithRole = (
  data: unknown,
  role: UserRole
): CreateUserDto => {
  const schema = roleValidationRules[role] || createUserSchema;
  return schema.parse(data);
};