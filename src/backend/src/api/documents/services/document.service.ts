import { injectable } from 'tsyringe'; // @version ^4.8.0
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0
import { retry } from 'retry-ts'; // @version ^0.1.3
import {
    Document,
    DocumentType,
    DocumentStatus,
    DocumentVerificationResult
} from '../../../types/document.types';
import { DocumentModel } from '../../../database/models/document.model';
import { EncryptionService } from '../../../services/security/encryption.service';
import { Logger } from '../../../utils/logger';
import { DOCUMENT_UPLOAD_CONFIG } from '../../../utils/constants';
import { InternalServerError, ValidationError } from '../../../utils/errors';

/**
 * Enhanced service class for secure document management with encryption,
 * verification, and comprehensive monitoring capabilities.
 */
@injectable()
export class DocumentService {
    private readonly retryOptions = {
        maxRetries: DOCUMENT_UPLOAD_CONFIG.RETRY_ATTEMPTS,
        initialDelay: 1000,
        maxDelay: 5000,
        factor: 2,
        timeout: DOCUMENT_UPLOAD_CONFIG.VERIFICATION_TIMEOUT
    };

    constructor(
        private readonly documentModel: DocumentModel,
        private readonly verificationService: any, // Injected verification service
        private readonly storageService: any, // Injected storage service
        private readonly encryptionService: EncryptionService,
        private readonly logger: Logger
    ) {}

    /**
     * Securely uploads and processes a new document with encryption
     * @param fileBuffer Document file buffer
     * @param fileName Original file name
     * @param mimeType File MIME type
     * @param documentType Type of document being uploaded
     * @param checkId Associated background check ID
     * @returns Created document with encryption metadata
     */
    async uploadDocument(
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
        documentType: DocumentType,
        checkId: string
    ): Promise<Document> {
        try {
            // Validate input parameters
            this.validateUploadParameters(fileBuffer, mimeType, documentType);

            // Generate unique document ID
            const documentId = uuidv4();

            // Encrypt document content
            const encryptedData = await this.encryptionService.encrypt(fileBuffer);

            // Generate secure file path
            const filePath = this.generateSecureFilePath(documentId, fileName);

            // Upload encrypted document to storage
            const uploadResult = await this.storageService.uploadEncrypted(
                encryptedData.encryptedValue,
                filePath,
                {
                    metadata: {
                        iv: encryptedData.iv,
                        authTag: encryptedData.authTag,
                        keyVersion: encryptedData.keyVersion
                    }
                }
            );

            // Create document record
            const document = await this.documentModel.create({
                id: documentId,
                type: documentType,
                status: DocumentStatus.PENDING,
                checkId,
                url: uploadResult.url,
                fileSize: fileBuffer.length,
                mimeType,
                hash: await this.generateFileHash(fileBuffer),
                uploadedAt: new Date()
            });

            // Queue document for verification
            await this.queueDocumentVerification(document.id);

            this.logger.info('Document uploaded successfully', {
                documentId,
                checkId,
                type: documentType,
                size: fileBuffer.length
            });

            return document;
        } catch (error) {
            this.logger.error('Document upload failed', {
                error,
                fileName,
                documentType,
                checkId
            });
            throw error;
        }
    }

    /**
     * Performs document verification with retry mechanism
     * @param id Document ID
     * @param retryOptions Optional retry configuration
     * @returns Document with verification results
     */
    async verifyDocumentWithRetry(
        id: string,
        retryOptions = this.retryOptions
    ): Promise<Document> {
        try {
            return await retry(async () => {
                // Retrieve document
                const document = await this.documentModel.findById(id);
                if (!document) {
                    throw new Error(`Document not found: ${id}`);
                }

                // Decrypt document for verification
                const encryptedContent = await this.storageService.downloadEncrypted(
                    document.url
                );
                const decryptedBuffer = await this.encryptionService.decrypt({
                    encryptedValue: encryptedContent.data,
                    iv: encryptedContent.metadata.iv,
                    authTag: encryptedContent.metadata.authTag,
                    keyVersion: encryptedContent.metadata.keyVersion
                });

                // Perform verification
                const verificationResult = await this.verificationService.verify(
                    decryptedBuffer,
                    document.type
                );

                // Update document with verification results
                const updatedDocument = await this.documentModel.updateVerificationResult(
                    id,
                    verificationResult
                );

                this.logger.info('Document verification completed', {
                    documentId: id,
                    status: updatedDocument.status,
                    isAuthentic: verificationResult.isAuthentic
                });

                return updatedDocument;
            }, retryOptions);
        } catch (error) {
            this.logger.error('Document verification failed', {
                error,
                documentId: id
            });
            throw new InternalServerError('Document verification failed', {
                documentId: id
            });
        }
    }

    /**
     * Validates upload parameters against security requirements
     */
    private validateUploadParameters(
        fileBuffer: Buffer,
        mimeType: string,
        documentType: DocumentType
    ): void {
        const validationErrors = [];

        if (fileBuffer.length > DOCUMENT_UPLOAD_CONFIG.MAX_FILE_SIZE) {
            validationErrors.push({
                field: 'fileSize',
                message: `File size exceeds maximum allowed size of ${DOCUMENT_UPLOAD_CONFIG.MAX_FILE_SIZE} bytes`
            });
        }

        if (!DOCUMENT_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType)) {
            validationErrors.push({
                field: 'mimeType',
                message: `Invalid file type. Allowed types: ${DOCUMENT_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`
            });
        }

        if (!Object.values(DocumentType).includes(documentType)) {
            validationErrors.push({
                field: 'documentType',
                message: 'Invalid document type'
            });
        }

        if (validationErrors.length > 0) {
            throw new ValidationError('Invalid upload parameters', validationErrors);
        }
    }

    /**
     * Generates secure file path for document storage
     */
    private generateSecureFilePath(documentId: string, fileName: string): string {
        const timestamp = Date.now();
        const extension = fileName.split('.').pop();
        return `documents/${documentId}/${timestamp}.${extension}`;
    }

    /**
     * Generates cryptographic hash of file content
     */
    private async generateFileHash(buffer: Buffer): Promise<string> {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Queues document for asynchronous verification
     */
    private async queueDocumentVerification(documentId: string): Promise<void> {
        // Implementation would integrate with message queue system
        await this.verificationService.queueVerification(documentId);
    }
}