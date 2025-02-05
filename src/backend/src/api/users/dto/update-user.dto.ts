// @package zod version ^3.22.0
import { z } from 'zod';
import { UserRole, UserStatus, UserProfile } from '../../types/user.types';

/**
 * Schema for validating user profile updates with strict validation rules
 * Includes transformation for consistent data formatting and security
 */
const profileSchema = z.object({
  first_name: z.string()
    .min(1, 'First name is required')
    .trim()
    .transform(s => s.toLowerCase()),
  last_name: z.string()
    .min(1, 'Last name is required')
    .trim()
    .transform(s => s.toLowerCase()),
  phone: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format. Must follow E.164 format')
    .optional(),
  avatar_url: z.string()
    .url('Invalid avatar URL format')
    .optional(),
  timezone: z.string()
    .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, 'Invalid timezone format. Must follow Area/Location pattern')
    .optional()
}).strict();

/**
 * Comprehensive DTO schema for user updates with role-based validation
 * and enhanced security controls
 */
export const UpdateUserDto = z.object({
  // Optional role update with strict enum validation
  role: z.enum([
    UserRole.SYSTEM_ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.HR_MANAGER,
    UserRole.CANDIDATE
  ]).optional(),

  // Optional status update with strict enum validation
  status: z.enum([
    UserStatus.ACTIVE,
    UserStatus.INACTIVE,
    UserStatus.SUSPENDED,
    UserStatus.PENDING_VERIFICATION
  ]).optional(),

  // Optional profile update with comprehensive validation
  profile: profileSchema.optional()
}).strict().refine(
  data => {
    // Ensure at least one field is provided for update
    return Object.keys(data).length > 0;
  },
  {
    message: 'At least one field must be provided for update',
    path: ['_errors']
  }
);

/**
 * Type inference from the Zod schema for TypeScript type safety
 */
export type UpdateUserDtoType = z.infer<typeof UpdateUserDto>;

/**
 * Type guard to validate if the input matches the UpdateUserDto schema
 * @param input - The input to validate
 * @returns boolean indicating if the input is valid
 */
export const isValidUpdateUserDto = (input: unknown): input is UpdateUserDtoType => {
  try {
    UpdateUserDto.parse(input);
    return true;
  } catch {
    return false;
  }
};