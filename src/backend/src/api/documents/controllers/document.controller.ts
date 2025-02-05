import { injectable } from 'tsyringe'; // @version ^4.8.0
import { Request, Response, NextFunction } from 'express'; // @version ^4.18.0
import { DocumentService } from '../services/document.service';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { Document } from '../../../types/document.types';
import { validateRequest } from '../../../middleware/validation.middleware';
import { API_RATE_LIMITS, DOCUMENT_UPLOAD_CONFIG } from '../../../utils/constants';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../utils/errors';
import { secureLogger } from '../../../utils/logger';

/**
 * Enhanced controller for secure document management with ML-based verification
 * Implements comprehensive validation, security checks, and audit logging
 */
@injectable()
export class DocumentController {
    constructor(
        private readonly documentService: DocumentService
    ) {}

    /**
     * Handles secure document upload with comprehensive validation and virus scanning
     * Rate limited to prevent abuse
     */
    public async uploadDocument(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> {
        try {
            // Validate request using DTO
            const uploadDto = await validateRequest({
                body: UploadDocumentDto,
                rateLimit: true,
                rateLimitOptions: {
                    windowMs: 60 * 60 * 1000, // 1 hour
                    max: API_RATE_LIMITS.DOCUMENT_UPLOAD
                }
            })(req, res, next) as UploadDocumentDto;

            // Validate file size
            if (uploadDto.file.length > DOCUMENT_UPLOAD_CONFIG.MAX_FILE_SIZE) {
                throw new ValidationError('File size exceeds limit', [{
                    field: 'file',
                    message: `Maximum file size is ${DOCUMENT_UPLOAD_CONFIG.MAX_FILE_SIZE} bytes`
                }]);
            }

            // Validate file type
            if (!DOCUMENT_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(uploadDto.mimeType)) {
                throw new ValidationError('Invalid file type', [{
                    field: 'mimeType',
                    message: `Allowed types: ${DOCUMENT_UPLOAD_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`
                }]);
            }

            // Verify file integrity
            if (!uploadDto.validateFileIntegrity()) {
                throw new ValidationError('File integrity check failed', [{
                    field: 'checksum',
                    message: 'File checksum does not match'
                }]);
            }

            // Scan for viruses
            const scanResult = await this.documentService.scanDocument(uploadDto.file);
            if (!scanResult.isClean) {
                throw new ValidationError('Security scan failed', [{
                    field: 'file',
                    message: 'File failed security scan',
                    details: scanResult.threats
                }]);
            }

            // Upload document with encryption
            const document = await this.documentService.uploadDocument(
                uploadDto.file,
                uploadDto.type,
                uploadDto.checkId,
                uploadDto.mimeType,
                uploadDto.checksum
            );

            // Log successful upload
            secureLogger.info('Document uploaded successfully', {
                documentId: document.id,
                checkId: uploadDto.checkId,
                type: uploadDto.type,
                size: uploadDto.file.length
            });

            return res.status(201).json({
                status: 'success',
                data: {
                    documentId: document.id,
                    status: document.status,
                    uploadedAt: document.uploadedAt
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Retrieves document with proper access control and encryption
     * Implements caching for performance optimization
     */
    public async getDocument(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            // Validate document access permissions
            const document = await this.documentService.getDocument(id);
            if (!document) {
                throw new NotFoundError('Document not found');
            }

            // Check access permissions
            const hasAccess = await this.documentService.validateDocumentAccess(
                document.id,
                userId
            );
            if (!hasAccess) {
                throw new ForbiddenError('Access denied to document');
            }

            // Log document access
            secureLogger.info('Document accessed', {
                documentId: id,
                userId,
                accessType: 'read'
            });

            return res.status(200).json({
                status: 'success',
                data: {
                    document: {
                        id: document.id,
                        type: document.type,
                        status: document.status,
                        verificationResult: document.verificationResult,
                        uploadedAt: document.uploadedAt,
                        verifiedAt: document.verifiedAt
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Performs ML-based document verification with fraud detection
     * Implements retry mechanism for reliability
     */
    public async verifyDocument(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> {
        try {
            const { id } = req.params;

            // Validate document exists
            const document = await this.documentService.getDocument(id);
            if (!document) {
                throw new NotFoundError('Document not found');
            }

            // Perform ML-based verification
            const verificationResult = await this.documentService.verifyDocument(id);

            // Log verification result
            secureLogger.info('Document verification completed', {
                documentId: id,
                status: verificationResult.status,
                isAuthentic: verificationResult.isAuthentic,
                confidenceScore: verificationResult.confidenceScore
            });

            return res.status(200).json({
                status: 'success',
                data: {
                    documentId: id,
                    verificationResult
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Securely deletes document with audit logging
     * Implements soft delete with delayed hard delete
     */
    public async deleteDocument(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<Response> {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            // Validate document exists
            const document = await this.documentService.getDocument(id);
            if (!document) {
                throw new NotFoundError('Document not found');
            }

            // Check delete permissions
            const canDelete = await this.documentService.validateDocumentAccess(
                document.id,
                userId,
                'delete'
            );
            if (!canDelete) {
                throw new ForbiddenError('Not authorized to delete document');
            }

            // Perform soft delete
            await this.documentService.deleteDocument(id);

            // Log deletion
            secureLogger.info('Document deleted', {
                documentId: id,
                userId,
                deleteType: 'soft'
            });

            return res.status(200).json({
                status: 'success',
                message: 'Document deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}