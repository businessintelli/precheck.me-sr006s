import { z } from 'zod'; // @version ^3.22.0
import { IsString, IsOptional, IsEnum } from 'class-validator'; // @version ^0.14.0
import { OrganizationType, OrganizationBranding } from '../../../types/organization.types';
import { validateDTO } from '../../../utils/validators';

/**
 * Comprehensive Zod schema for organization creation validation with enhanced security rules
 */
export const createOrganizationSchema = z.object({
  name: z.string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(255, 'Organization name cannot exceed 255 characters')
    .regex(/^[a-zA-Z0-9\s-]+$/, 'Organization name can only contain alphanumeric characters, spaces, and hyphens')
    .transform(val => val.trim()),

  type: z.nativeEnum(OrganizationType, {
    errorMap: () => ({ message: 'Invalid organization type' })
  }),

  subscription_tier: z.string()
    .refine(
      (val) => ['basic', 'pro', 'enterprise'].includes(val.toLowerCase()),
      'Invalid subscription tier. Must be one of: basic, pro, enterprise'
    ),

  branding: z.object({
    logo_url: z.string()
      .url('Invalid logo URL format')
      .startsWith('https://', 'Logo URL must use HTTPS'),
    primary_color: z.string()
      .regex(/^#[0-9A-F]{6}$/i, 'Primary color must be a valid hex color code'),
    secondary_color: z.string()
      .regex(/^#[0-9A-F]{6}$/i, 'Secondary color must be a valid hex color code'),
    company_name: z.string()
      .min(2, 'Company name must be at least 2 characters')
      .max(255, 'Company name cannot exceed 255 characters')
  }).optional(),

  allowed_domains: z.array(
    z.string()
      .email('Invalid email domain format')
      .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format')
  ).min(1, 'At least one allowed domain is required')
});

/**
 * Data Transfer Object for organization creation with comprehensive validation
 */
export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsEnum(OrganizationType)
  type: OrganizationType;

  @IsString()
  subscription_tier: string;

  @IsOptional()
  branding?: OrganizationBranding;

  @IsString({ each: true })
  allowed_domains: string[];
}

/**
 * Enhanced validation function for organization creation DTO with security checks
 * @param data - Raw input data for organization creation
 * @returns Promise resolving to validated and sanitized CreateOrganizationDto
 */
export async function validateCreateOrganizationDto(
  data: unknown
): Promise<CreateOrganizationDto> {
  return validateDTO(createOrganizationSchema, data, {
    rateLimit: true,
    clientId: 'organization_creation',
    context: {
      operation: 'create_organization',
      validationLevel: 'strict'
    }
  });
}