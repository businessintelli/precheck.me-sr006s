import { 
    IsString, 
    IsEnum, 
    IsUUID, 
    IsOptional, 
    IsHash, 
    IsDate,
} from 'class-validator'; // ^0.14.0
import { ValidMimeType } from 'class-validator-extended'; // ^1.0.0
import { DocumentType } from '../../../types/document.types';
import * as crypto from 'crypto';

/**
 * Data Transfer Object for document upload operations with comprehensive
 * validation and security features. Implements strict file validation,
 * size limits, and integrity checks for secure document processing.
 */
export class UploadDocumentDto {
    /**
     * Document file buffer with size and type validation
     * Maximum size: 10MB (10485760 bytes)
     * Allowed formats: PDF, JPEG, PNG
     */
    @ValidMimeType(['application/pdf', 'image/jpeg', 'image/png'])
    file: Buffer;

    /**
     * Type of document being uploaded
     * Must match one of the predefined document types
     */
    @IsEnum(DocumentType)
    type: DocumentType;

    /**
     * UUID of the associated background check
     * Required for document association and tracking
     */
    @IsUUID()
    checkId: string;

    /**
     * Optional document description
     * Provides additional context about the uploaded document
     */
    @IsOptional()
    @IsString()
    description?: string;

    /**
     * SHA-256 hash for file integrity verification
     * Used to ensure document hasn't been tampered with during upload
     */
    @IsHash('sha256')
    checksum: string;

    /**
     * Document MIME type for validation
     * Must match allowed file types
     */
    @IsString()
    mimeType: string;

    /**
     * Optional document expiration date
     * Required for certain document types (e.g., licenses)
     */
    @IsOptional()
    @IsDate()
    expiryDate?: Date;

    /**
     * Validates the integrity of the uploaded file by comparing
     * the provided checksum with a calculated hash of the file buffer
     * 
     * @returns boolean indicating whether the file integrity is verified
     */
    validateFileIntegrity(): boolean {
        if (!this.file || !this.checksum) {
            return false;
        }

        const calculatedHash = crypto
            .createHash('sha256')
            .update(this.file)
            .digest('hex');

        return calculatedHash.toLowerCase() === this.checksum.toLowerCase();
    }
}