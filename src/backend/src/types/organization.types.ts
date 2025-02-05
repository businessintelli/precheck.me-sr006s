// @package zod version ^3.22.0
import { z } from 'zod';

/**
 * Organization type enumeration for categorizing organizations and determining feature access
 */
export enum OrganizationType {
  ENTERPRISE = 'ENTERPRISE',
  BUSINESS = 'BUSINESS',
  STARTUP = 'STARTUP'
}

/**
 * Organization status enumeration for subscription and account state tracking
 */
export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED'
}

/**
 * Interface for organization white-labeling and branding configuration
 */
export interface OrganizationBranding {
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  company_name: string;
}

/**
 * Interface for comprehensive organization configuration and feature settings
 */
export interface OrganizationSettings {
  allowed_domains: string[];
  max_users: number;
  max_checks_per_month: number;
  allowed_check_types: string[];
  branding: OrganizationBranding;
}

/**
 * Main interface for organization entity with complete type definitions
 */
export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  subscription_tier: string;
  subscription_expires: Date;
  settings: OrganizationSettings;
  created_at: Date;
  updated_at: Date;
}

/**
 * Subscription tier constants for organization plans
 */
export const SUBSCRIPTION_TIERS = ['free', 'basic', 'professional', 'enterprise'] as const;

/**
 * Maximum users allowed per subscription tier
 */
export const MAX_USERS_BY_TIER = {
  free: 5,
  basic: 20,
  professional: 100,
  enterprise: 500
} as const;

/**
 * Maximum background checks allowed per month by subscription tier
 */
export const MAX_CHECKS_BY_TIER = {
  free: 10,
  basic: 50,
  professional: 200,
  enterprise: 1000
} as const;

/**
 * Zod schema for organization name validation
 */
export const organizationNameSchema = z.string()
  .min(2, 'Organization name must be at least 2 characters')
  .max(255, 'Organization name cannot exceed 255 characters')
  .regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Organization name can only contain alphanumeric characters, spaces, hyphens, underscores, and periods');

/**
 * Zod schema for organization domain validation
 */
export const organizationDomainSchema = z.string()
  .regex(/^(?!:\/\/)(?:[a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}$/,
    'Invalid domain format');

/**
 * Validates organization name format and length with comprehensive rules
 * @param name - Organization name to validate
 * @returns boolean indicating if the name meets all validation criteria
 */
export const validateOrganizationName = (name: string): boolean => {
  try {
    organizationNameSchema.parse(name);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates organization domain format and availability
 * @param domain - Domain to validate
 * @returns boolean indicating if the domain is valid and available
 */
export const validateOrganizationDomain = (domain: string): boolean => {
  try {
    organizationDomainSchema.parse(domain);
    return true;
  } catch {
    return false;
  }
};

/**
 * Type for subscription tier string literal union
 */
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

/**
 * Zod schema for complete organization validation
 */
export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: organizationNameSchema,
  type: z.nativeEnum(OrganizationType),
  status: z.nativeEnum(OrganizationStatus),
  subscription_tier: z.enum(SUBSCRIPTION_TIERS),
  subscription_expires: z.date(),
  settings: z.object({
    allowed_domains: z.array(organizationDomainSchema),
    max_users: z.number().positive(),
    max_checks_per_month: z.number().positive(),
    allowed_check_types: z.array(z.string()),
    branding: z.object({
      logo_url: z.string().url(),
      primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      company_name: z.string().min(1)
    })
  }),
  created_at: z.date(),
  updated_at: z.date()
});