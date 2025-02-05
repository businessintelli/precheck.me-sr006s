// @ts-check
import { z } from 'zod'; // v3.22.0

/**
 * Enum representing different levels of background check packages
 * with corresponding verification requirements
 */
export enum BackgroundCheckType {
  BASIC = 'BASIC',           // Identity & Employment verification
  STANDARD = 'STANDARD',     // Basic + Education verification
  COMPREHENSIVE = 'COMPREHENSIVE' // Standard + Criminal verification
}

/**
 * Enum representing all possible states of a background check process
 * with defined state transitions
 */
export enum BackgroundCheckStatus {
  INITIATED = 'INITIATED',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  DOCUMENTS_UPLOADED = 'DOCUMENTS_UPLOADED',
  VERIFICATION_IN_PROGRESS = 'VERIFICATION_IN_PROGRESS',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

/**
 * Interface representing individual verification result with audit trail
 */
export interface VerificationResult {
  verified: boolean;
  status: string;
  details: Record<string, unknown>;
  verifiedAt: Date;
  verifiedBy: string;
}

/**
 * Interface containing verification results for different check types
 */
export interface VerificationResults {
  identity: VerificationResult;
  employment: VerificationResult;
  education: VerificationResult;
  criminal: VerificationResult;
}

/**
 * Comprehensive interface for background check entity
 */
export interface BackgroundCheck {
  id: string;
  type: BackgroundCheckType;
  status: BackgroundCheckStatus;
  candidateId: string;
  organizationId: string;
  requestedBy: string;
  documentIds: string[];
  interviewId: string;
  verificationResults: VerificationResults;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for verification result with strict validation
 */
const verificationResultSchema = z.object({
  verified: z.boolean(),
  status: z.string().min(1),
  details: z.record(z.unknown()),
  verifiedAt: z.date(),
  verifiedBy: z.string().uuid()
});

/**
 * Zod schema for verification results with required fields
 */
const verificationResultsSchema = z.object({
  identity: verificationResultSchema,
  employment: verificationResultSchema,
  education: verificationResultSchema,
  criminal: verificationResultSchema
});

/**
 * Zod schema for creating new background checks with validation rules
 */
export const CreateBackgroundCheckDto = z.object({
  type: z.nativeEnum(BackgroundCheckType),
  candidateId: z.string().uuid(),
  organizationId: z.string().uuid()
});

/**
 * Zod schema for updating background check status and results
 */
export const UpdateBackgroundCheckDto = z.object({
  status: z.nativeEnum(BackgroundCheckStatus),
  verificationResults: verificationResultsSchema.partial()
}).strict();

// Inferred types from Zod schemas
export type CreateBackgroundCheckDtoType = z.infer<typeof CreateBackgroundCheckDto>;
export type UpdateBackgroundCheckDtoType = z.infer<typeof UpdateBackgroundCheckDto>;