import { PrismaClient } from '@prisma/client'; // @version ^5.4.2
import { injectable } from 'tsyringe'; // @version ^4.8.0
import { Logger } from 'winston'; // @version ^3.11.0
import {
    Document,
    DocumentType,
    DocumentStatus,
    DocumentVerificationResult
} from '../../types/document.types';

/**
 * Model class for managing document-related database operations with enhanced
 * verification capabilities and secure document processing.
 */
@injectable()
export class DocumentModel {
    private readonly CACHE_TTL = 3600; // 1 hour cache TTL
    private readonly BATCH_SIZE = 100; // Batch processing size for large queries

    constructor(
        private readonly prisma: PrismaClient,
        private readonly logger: Logger
    ) {
        this.setupErrorHandlers();
    }

    /**
     * Sets up error handlers for database connection and query monitoring
     */
    private setupErrorHandlers(): void {
        this.prisma.$on('error', (error) => {
            this.logger.error('Prisma Client Error:', {
                error: error.message,
                stack: error.stack
            });
        });
    }

    /**
     * Creates a new document record with validation and initial verification state
     * @param data Document creation data transfer object
     * @returns Promise resolving to created document
     */
    async create(data: Omit<Document, 'id' | 'verifiedAt' | 'verificationResult'>): Promise<Document> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                // Validate document type
                if (!Object.values(DocumentType).includes(data.type)) {
                    throw new Error(`Invalid document type: ${data.type}`);
                }

                const document = await tx.document.create({
                    data: {
                        ...data,
                        status: DocumentStatus.PENDING,
                        verificationResult: null,
                        uploadedAt: new Date(),
                        verifiedAt: null
                    }
                });

                this.logger.info('Document created successfully', {
                    documentId: document.id,
                    checkId: document.checkId
                });

                return document;
            });
        } catch (error) {
            this.logger.error('Error creating document:', {
                error: error.message,
                data
            });
            throw error;
        }
    }

    /**
     * Retrieves a document by ID with caching and relationship loading
     * @param id Document identifier
     * @returns Promise resolving to document or null if not found
     */
    async findById(id: string): Promise<Document | null> {
        try {
            const document = await this.prisma.document.findUnique({
                where: { id },
                include: {
                    verificationResult: true,
                    backgroundCheck: true
                }
            });

            if (!document) {
                this.logger.debug('Document not found', { id });
                return null;
            }

            return document;
        } catch (error) {
            this.logger.error('Error finding document by ID:', {
                error: error.message,
                id
            });
            throw error;
        }
    }

    /**
     * Retrieves all documents associated with a background check
     * @param checkId Background check identifier
     * @returns Promise resolving to array of documents
     */
    async findByCheckId(checkId: string): Promise<Document[]> {
        try {
            const documents = await this.prisma.document.findMany({
                where: { checkId },
                include: {
                    verificationResult: true
                },
                orderBy: {
                    uploadedAt: 'desc'
                }
            });

            return documents;
        } catch (error) {
            this.logger.error('Error finding documents by check ID:', {
                error: error.message,
                checkId
            });
            throw error;
        }
    }

    /**
     * Updates document verification result and status with validation
     * @param id Document identifier
     * @param result Verification result data
     * @returns Promise resolving to updated document
     */
    async updateVerificationResult(
        id: string,
        result: DocumentVerificationResult
    ): Promise<Document> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const document = await tx.document.findUnique({
                    where: { id }
                });

                if (!document) {
                    throw new Error(`Document not found: ${id}`);
                }

                // Determine new status based on verification result
                const newStatus = this.determineDocumentStatus(result);

                const updatedDocument = await tx.document.update({
                    where: { id },
                    data: {
                        status: newStatus,
                        verificationResult: result,
                        verifiedAt: new Date()
                    },
                    include: {
                        verificationResult: true
                    }
                });

                this.logger.info('Document verification updated', {
                    documentId: id,
                    status: newStatus,
                    isAuthentic: result.isAuthentic
                });

                return updatedDocument;
            });
        } catch (error) {
            this.logger.error('Error updating document verification:', {
                error: error.message,
                documentId: id
            });
            throw error;
        }
    }

    /**
     * Determines document status based on verification result
     * @param result Verification result data
     * @returns Determined document status
     */
    private determineDocumentStatus(result: DocumentVerificationResult): DocumentStatus {
        if (result.isAuthentic && result.confidenceScore >= 0.9) {
            return DocumentStatus.VERIFIED;
        } else if (result.confidenceScore < 0.6) {
            return DocumentStatus.REJECTED;
        } else if (result.issues.length > 0) {
            return DocumentStatus.MANUAL_REVIEW_REQUIRED;
        }
        return DocumentStatus.PROCESSING;
    }
}