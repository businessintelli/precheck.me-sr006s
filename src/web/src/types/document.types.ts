/**
 * Type definitions for document-related entities in the Precheck.me platform.
 * Implements secure document storage and verification system with comprehensive type safety.
 * @version 1.0.0
 */

/**
 * Enumeration of supported document types in the system.
 * Maps to allowed document categories for background verification.
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
 * Enumeration of possible document verification statuses.
 * Tracks the lifecycle of a document through the verification process.
 */
export enum DocumentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED',
    ERROR = 'ERROR',
    REQUIRES_MANUAL_REVIEW = 'REQUIRES_MANUAL_REVIEW',
    EXPIRED = 'EXPIRED'
}

/**
 * Interface representing the results of AI-powered document verification.
 * Contains detailed verification metadata and confidence scores.
 */
export interface DocumentVerificationResult {
    /** Indicates if the document is verified as authentic */
    isAuthentic: boolean;
    
    /** Confidence score from 0-100 for the verification result */
    confidenceScore: number;
    
    /** Method used for verification (AI, manual, hybrid) */
    verificationMethod: string;
    
    /** Array of identified issues or concerns */
    issues: Array<string>;
    
    /** OCR-extracted text content, if applicable */
    extractedText: string | null;
    
    /** Additional verification metadata */
    metadata: Record<string, any>;
    
    /** AI model confidence score from 0-100 */
    aiConfidence: number;
    
    /** ID or name of the verifying entity (system/user) */
    verifiedBy: string;
    
    /** Timestamp of verification completion */
    verificationDate: Date;
    
    /** Document expiration date, if applicable */
    expiryDate: Date | null;
}

/**
 * Core interface representing a document entity with comprehensive metadata.
 * Implements security and audit fields for document tracking.
 */
export interface Document {
    /** Unique identifier for the document */
    id: string;
    
    /** Type classification of the document */
    type: DocumentType;
    
    /** Secure URL for document access */
    url: string;
    
    /** Current verification status */
    status: DocumentStatus;
    
    /** Associated background check ID */
    checkId: string;
    
    /** Detailed verification results */
    verificationResult: DocumentVerificationResult;
    
    /** Timestamp of initial upload */
    uploadedAt: Date;
    
    /** Timestamp of verification completion */
    verifiedAt: Date | null;
    
    /** Original filename */
    fileName: string;
    
    /** File size in bytes */
    fileSize: number;
    
    /** MIME type of the document */
    mimeType: string;
    
    /** Cryptographic hash for integrity verification */
    hash: string;
}

/**
 * Interface for document upload API responses.
 * Contains presigned URL and upload constraints.
 */
export interface DocumentUploadResponse {
    /** Created document entity */
    document: Document;
    
    /** Presigned URL for secure upload */
    uploadUrl: string;
    
    /** URL expiration time in seconds */
    expiresIn: number;
    
    /** Maximum allowed file size in bytes */
    maxSize: number;
    
    /** Array of allowed MIME types */
    allowedTypes: Array<string>;
}

/**
 * Interface for paginated document list API responses.
 * Supports efficient document listing and pagination.
 */
export interface DocumentListResponse {
    /** Array of document entities */
    documents: Array<Document>;
    
    /** Total number of documents matching query */
    total: number;
    
    /** Current page number */
    page: number;
    
    /** Number of items per page */
    pageSize: number;
    
    /** Indicates if more pages are available */
    hasMore: boolean;
}