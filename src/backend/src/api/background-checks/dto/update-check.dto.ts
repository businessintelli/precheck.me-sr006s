// @package zod version ^3.22.0
import { z } from 'zod';
import { BackgroundCheckStatus, VerificationResults } from '../../types/background-check.types';
import { validateDTO } from '../../../utils/validators';

/**
 * Allowed status transitions map for background check workflow
 */
const ALLOWED_STATUS_TRANSITIONS: Record<BackgroundCheckStatus, BackgroundCheckStatus[]> = {
  [BackgroundCheckStatus.INITIATED]: [
    BackgroundCheckStatus.DOCUMENTS_PENDING,
    BackgroundCheckStatus.CANCELLED
  ],
  [BackgroundCheckStatus.DOCUMENTS_PENDING]: [
    BackgroundCheckStatus.DOCUMENTS_UPLOADED,
    BackgroundCheckStatus.CANCELLED
  ],
  [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: [
    BackgroundCheckStatus.VERIFICATION_IN_PROGRESS,
    BackgroundCheckStatus.REJECTED,
    BackgroundCheckStatus.CANCELLED
  ],
  [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: [
    BackgroundCheckStatus.INTERVIEW_SCHEDULED,
    BackgroundCheckStatus.REJECTED,
    BackgroundCheckStatus.CANCELLED
  ],
  [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: [
    BackgroundCheckStatus.INTERVIEW_COMPLETED,
    BackgroundCheckStatus.CANCELLED
  ],
  [BackgroundCheckStatus.INTERVIEW_COMPLETED]: [
    BackgroundCheckStatus.COMPLETED,
    BackgroundCheckStatus.REJECTED
  ],
  [BackgroundCheckStatus.COMPLETED]: [],
  [BackgroundCheckStatus.REJECTED]: [],
  [BackgroundCheckStatus.CANCELLED]: []
};

/**
 * Validation schema for verification result details
 */
const verificationDetailsSchema = z.object({
  verificationSource: z.string().optional(),
  matchPercentage: z.number().min(0).max(100).optional(),
  discrepancies: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
  flags: z.array(z.string()).optional()
});

/**
 * Validation schema for verifier metadata
 */
const verifierMetadataSchema = z.object({
  provider: z.string().optional(),
  referenceId: z.string().optional(),
  methodUsed: z.string().optional(),
  verifierCredentials: z.string().optional()
});

/**
 * Validation schema for individual verification result
 */
const verificationResultSchema = z.object({
  verified: z.boolean(),
  status: z.string(),
  details: verificationDetailsSchema,
  verifiedAt: z.date(),
  verifiedBy: z.string().uuid(),
  verificationMethod: z.string(),
  confidenceScore: z.number().min(0).max(100),
  verifierMetadata: verifierMetadataSchema,
  lastUpdated: z.date()
});

/**
 * Comprehensive schema for verification results
 */
const verificationResultsSchema = z.object({
  identity: verificationResultSchema.optional(),
  employment: verificationResultSchema.optional(),
  education: verificationResultSchema.optional(),
  criminal: verificationResultSchema.optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one verification result must be provided'
);

/**
 * Enhanced Zod schema for background check updates with transition validation
 */
export const updateBackgroundCheckSchema = z.object({
  status: z.nativeEnum(BackgroundCheckStatus)
    .refine(
      (newStatus, ctx) => {
        const currentStatus = ctx.parent?.currentStatus as BackgroundCheckStatus;
        if (!currentStatus) return true;
        return ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
      },
      {
        message: 'Invalid status transition',
        path: ['status']
      }
    ),
  verificationResults: verificationResultsSchema
    .refine(
      (results) => {
        // Ensure confidence scores meet minimum thresholds
        return Object.values(results).every(
          (result) => result?.confidenceScore >= 75
        );
      },
      {
        message: 'All verification results must meet minimum confidence threshold',
        path: ['verificationResults']
      }
    )
}).strict();

/**
 * Type definition for the update background check DTO
 */
export interface UpdateBackgroundCheckDto {
  status: BackgroundCheckStatus;
  verificationResults: VerificationResults;
}

/**
 * Validates and sanitizes the update background check DTO
 * @param data - Raw update data to validate
 * @returns Promise resolving to validated and sanitized DTO
 */
export async function validateUpdateBackgroundCheckDto(
  data: unknown
): Promise<UpdateBackgroundCheckDto> {
  return validateDTO(updateBackgroundCheckSchema, data, {
    rateLimit: true,
    context: { currentStatus: (data as any)?.currentStatus }
  });
}