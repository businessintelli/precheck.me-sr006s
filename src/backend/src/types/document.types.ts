/**
 * Type definitions for document handling, verification, and processing
 * within the background check system. Includes comprehensive interfaces
 * for document metadata, verification results, and security features.
 */

/**
 * Supported document types in the system
 */
export enum DocumentType {
    GOVERNMENT_ID = 'GOVERNMENT_ID',
    PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
    EMPLOYMENT_RECORD = 'EMPLOYMENT_RECORD',
    EDUCATION_CERTIFICATE = 'EDUCATION_CERTIFICATE',
    PROFESSIONAL_LICENSE = 'PROFESSIONAL_LICENSE',
    BACKGROUND_CHECK_CONSENT = 'BACKGROUND_CHECK_CONSENT'
}

/**
 * Document verification status states
 */
export enum DocumentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED',
    ERROR = 'ERROR',
    MANUAL_REVIEW_REQUIRED = 'MANUAL_REVIEW_REQUIRED',
    EXPIRED = 'EXPIRED'
}

/**
 * AI-based confidence metrics for document verification
 */
export interface AIConfidenceMetrics {
    textMatchScore: number;
    imageQualityScore: number;
    tamperingDetectionScore: number;
    formatValidationScore: number;
}

/**
 * Security feature verification details
 */
export interface SecurityFeature {
    featureType: string;
    isPresent: boolean;
    validationScore: number;
    location: string;
}

/**
 * Comprehensive verification result interface including
 * AI metrics and security feature validation
 */
export interface DocumentVerificationResult {
    isAuthentic: boolean;
    confidenceScore: number;
    verificationMethod: string;
    issues: Array<string>;
    extractedText: string | null;
    metadata: Record<string, any>;
    aiConfidenceMetrics: AIConfidenceMetrics;
    securityFeatures: Array<SecurityFeature>;
    verifiedBy: string;
    verificationTimestamp: Date;
}

/**
 * Main document interface representing a document entity
 * in the background check system
 */
export interface Document {
    /** Unique identifier for the document */
    id: string;

    /** Type of document based on predefined categories */
    type: DocumentType;

    /** Secure URL for document access */
    url: string;

    /** Current verification status */
    status: DocumentStatus;

    /** Reference to associated background check */
    checkId: string;

    /** Detailed verification results */
    verificationResult: DocumentVerificationResult;

    /** Document upload timestamp */
    uploadedAt: Date;

    /** Verification completion timestamp */
    verifiedAt: Date | null;

    /** Document file size in bytes */
    fileSize: number;

    /** Document MIME type */
    mimeType: string;

    /** Cryptographic hash of document content */
    hash: string;
}