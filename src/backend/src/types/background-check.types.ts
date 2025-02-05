// @package zod version ^3.22.0
import { z } from 'zod';
import { Document } from './document.types';
import { Interview } from './interview.types';

/**
 * Enum defining different levels of background check packages
 */
export enum BackgroundCheckType {
    BASIC = 'BASIC',           // Identity & Employment verification
    STANDARD = 'STANDARD',     // Basic + Education verification
    COMPREHENSIVE = 'COMPREHENSIVE' // Standard + Criminal & Professional checks
}

/**
 * Enum for tracking the status of background check processes
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
 * Interface for detailed verification results with comprehensive tracking
 */
export interface VerificationResult {
    verified: boolean;
    status: string;
    details: {
        verificationSource?: string;
        matchPercentage?: number;
        discrepancies?: string[];
        notes?: string;
        flags?: string[];
    };
    verifiedAt: Date;
    verifiedBy: string;
    verificationMethod: string;
    confidenceScore: number;
    verifierMetadata: {
        provider?: string;
        referenceId?: string;
        methodUsed?: string;
        verifierCredentials?: string;
    };
    lastUpdated: Date;
}

/**
 * Interface for background check verification components
 */
export interface VerificationComponent {
    type: string;
    status: BackgroundCheckStatus;
    result: VerificationResult | null;
    requiredDocuments: string[];
    startedAt: Date;
    completedAt: Date | null;
    priority: number;
}

/**
 * Interface for background check metadata
 */
export interface BackgroundCheckMetadata {
    requestedBy: string;
    department?: string;
    position?: string;
    urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
    notes?: string;
    customFields?: Record<string, unknown>;
}

/**
 * Interface for the main background check entity
 */
export interface BackgroundCheck {
    id: string;
    type: BackgroundCheckType;
    status: BackgroundCheckStatus;
    candidateId: string;
    organizationId: string;
    documents: Document['id'][];
    interviews: Interview['id'][];
    verifications: VerificationComponent[];
    results: VerificationResult[];
    metadata: BackgroundCheckMetadata;
    initiatedAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    expiresAt: Date;
}

/**
 * Zod schema for background check metadata validation
 */
const backgroundCheckMetadataSchema = z.object({
    requestedBy: z.string().uuid(),
    department: z.string().optional(),
    position: z.string().optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    notes: z.string().max(1000).optional(),
    customFields: z.record(z.unknown()).optional()
});

/**
 * Zod schema for creating new background checks with validation
 */
export const CreateBackgroundCheckDto = z.object({
    type: z.nativeEnum(BackgroundCheckType),
    candidateId: z.string().uuid(),
    organizationId: z.string().uuid(),
    customVerificationTypes: z.array(z.string()).optional(),
    metadata: backgroundCheckMetadataSchema
}).strict();

/**
 * Type guard to check if a value is a valid BackgroundCheckType
 */
export const isBackgroundCheckType = (value: any): value is BackgroundCheckType => {
    return Object.values(BackgroundCheckType).includes(value as BackgroundCheckType);
};

/**
 * Type guard to check if a value is a valid BackgroundCheckStatus
 */
export const isBackgroundCheckStatus = (value: any): value is BackgroundCheckStatus => {
    return Object.values(BackgroundCheckStatus).includes(value as BackgroundCheckStatus);
};

/**
 * Validation function for background check expiration date
 */
export const validateExpirationDate = (date: Date): boolean => {
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() + 1); // Minimum 1 year validity
    return date >= minDate;
};

/**
 * Type for background check progress tracking
 */
export type BackgroundCheckProgress = {
    totalSteps: number;
    completedSteps: number;
    currentStep: string;
    estimatedCompletion: Date;
    blockers: string[];
};