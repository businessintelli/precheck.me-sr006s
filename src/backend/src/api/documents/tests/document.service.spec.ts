import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // @version ^29.0.0
import { container } from 'tsyringe'; // @version ^4.8.0
import { DocumentService } from '../services/document.service';
import { Document, DocumentType, DocumentStatus } from '../../../types/document.types';
import { DOCUMENT_UPLOAD_CONFIG } from '../../../utils/constants';
import { ValidationError } from '../../../utils/errors';
import { secureLogger } from '../../../utils/logger';

describe('DocumentService', () => {
    let documentService: DocumentService;
    let mockDocumentModel: jest.Mocked<any>;
    let mockVerificationService: jest.Mocked<any>;
    let mockStorageService: jest.Mocked<any>;
    let mockEncryptionService: jest.Mocked<any>;
    let mockLogger: jest.Mocked<any>;

    const testFile = {
        buffer: Buffer.from('test document content'),
        originalname: 'test-document.pdf',
        mimetype: 'application/pdf',
        size: 1024
    };

    const mockEncryptedData = {
        encryptedValue: 'encrypted-content',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        keyVersion: 'v1'
    };

    const mockDocument: Document = {
        id: 'test-doc-id',
        type: DocumentType.GOVERNMENT_ID,
        status: DocumentStatus.PENDING,
        url: 'https://storage.test/documents/test-doc-id',
        checkId: 'test-check-id',
        verificationResult: null,
        uploadedAt: new Date(),
        verifiedAt: null,
        fileSize: 1024,
        mimeType: 'application/pdf',
        hash: 'test-hash'
    };

    beforeEach(() => {
        // Reset container and setup mocks
        container.clearInstances();

        mockDocumentModel = {
            create: jest.fn(),
            findById: jest.fn(),
            updateVerificationResult: jest.fn()
        };

        mockVerificationService = {
            verify: jest.fn(),
            queueVerification: jest.fn()
        };

        mockStorageService = {
            uploadEncrypted: jest.fn(),
            downloadEncrypted: jest.fn(),
            deleteSecurely: jest.fn()
        };

        mockEncryptionService = {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
            generateMetadata: jest.fn()
        };

        mockLogger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        };

        // Register mocks with container
        container.registerInstance('DocumentModel', mockDocumentModel);
        container.registerInstance('VerificationService', mockVerificationService);
        container.registerInstance('StorageService', mockStorageService);
        container.registerInstance('EncryptionService', mockEncryptionService);
        container.registerInstance('Logger', mockLogger);

        // Create service instance
        documentService = container.resolve(DocumentService);
    });

    afterEach(() => {
        jest.clearAllMocks();
        container.clearInstances();
    });

    describe('uploadDocument', () => {
        it('should securely upload and encrypt a document', async () => {
            // Setup mock responses
            mockEncryptionService.encrypt.mockResolvedValue(mockEncryptedData);
            mockStorageService.uploadEncrypted.mockResolvedValue({ url: mockDocument.url });
            mockDocumentModel.create.mockResolvedValue(mockDocument);

            // Execute test
            const result = await documentService.uploadDocument(
                testFile.buffer,
                testFile.originalname,
                testFile.mimetype,
                DocumentType.GOVERNMENT_ID,
                'test-check-id'
            );

            // Verify encryption
            expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(testFile.buffer);

            // Verify secure storage
            expect(mockStorageService.uploadEncrypted).toHaveBeenCalledWith(
                mockEncryptedData.encryptedValue,
                expect.stringContaining('documents/'),
                expect.objectContaining({
                    metadata: {
                        iv: mockEncryptedData.iv,
                        authTag: mockEncryptedData.authTag,
                        keyVersion: mockEncryptedData.keyVersion
                    }
                })
            );

            // Verify document creation
            expect(mockDocumentModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: DocumentType.GOVERNMENT_ID,
                    status: DocumentStatus.PENDING,
                    checkId: 'test-check-id',
                    url: mockDocument.url,
                    fileSize: testFile.buffer.length,
                    mimeType: testFile.mimetype
                })
            );

            // Verify result
            expect(result).toEqual(mockDocument);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        it('should validate file size and type restrictions', async () => {
            const largeFile = {
                ...testFile,
                buffer: Buffer.alloc(DOCUMENT_UPLOAD_CONFIG.MAX_FILE_SIZE + 1)
            };

            await expect(
                documentService.uploadDocument(
                    largeFile.buffer,
                    largeFile.originalname,
                    'application/unknown',
                    DocumentType.GOVERNMENT_ID,
                    'test-check-id'
                )
            ).rejects.toThrow(ValidationError);
        });

        it('should handle encryption failures securely', async () => {
            mockEncryptionService.encrypt.mockRejectedValue(new Error('Encryption failed'));

            await expect(
                documentService.uploadDocument(
                    testFile.buffer,
                    testFile.originalname,
                    testFile.mimetype,
                    DocumentType.GOVERNMENT_ID,
                    'test-check-id'
                )
            ).rejects.toThrow('Document upload failed');

            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('verifyDocument', () => {
        const mockVerificationResult = {
            isAuthentic: true,
            confidenceScore: 0.95,
            verificationMethod: 'AI',
            issues: [],
            verifiedBy: 'AI-Service',
            verificationTimestamp: new Date()
        };

        it('should verify document with AI service and retry mechanism', async () => {
            // Setup mocks
            mockDocumentModel.findById.mockResolvedValue(mockDocument);
            mockStorageService.downloadEncrypted.mockResolvedValue({
                data: mockEncryptedData.encryptedValue,
                metadata: {
                    iv: mockEncryptedData.iv,
                    authTag: mockEncryptedData.authTag,
                    keyVersion: mockEncryptedData.keyVersion
                }
            });
            mockEncryptionService.decrypt.mockResolvedValue(testFile.buffer);
            mockVerificationService.verify.mockResolvedValue(mockVerificationResult);
            mockDocumentModel.updateVerificationResult.mockResolvedValue({
                ...mockDocument,
                status: DocumentStatus.VERIFIED,
                verificationResult: mockVerificationResult
            });

            // Execute test
            const result = await documentService.verifyDocumentWithRetry('test-doc-id');

            // Verify decryption
            expect(mockEncryptionService.decrypt).toHaveBeenCalledWith({
                encryptedValue: mockEncryptedData.encryptedValue,
                iv: mockEncryptedData.iv,
                authTag: mockEncryptedData.authTag,
                keyVersion: mockEncryptedData.keyVersion
            });

            // Verify AI service call
            expect(mockVerificationService.verify).toHaveBeenCalledWith(
                testFile.buffer,
                DocumentType.GOVERNMENT_ID
            );

            // Verify result update
            expect(mockDocumentModel.updateVerificationResult).toHaveBeenCalledWith(
                'test-doc-id',
                mockVerificationResult
            );

            expect(result.status).toBe(DocumentStatus.VERIFIED);
            expect(result.verificationResult).toEqual(mockVerificationResult);
        });

        it('should implement retry logic for failed verifications', async () => {
            mockVerificationService.verify
                .mockRejectedValueOnce(new Error('Verification failed'))
                .mockRejectedValueOnce(new Error('Verification failed'))
                .mockResolvedValueOnce(mockVerificationResult);

            mockDocumentModel.findById.mockResolvedValue(mockDocument);
            mockStorageService.downloadEncrypted.mockResolvedValue({
                data: mockEncryptedData.encryptedValue,
                metadata: {
                    iv: mockEncryptedData.iv,
                    authTag: mockEncryptedData.authTag,
                    keyVersion: mockEncryptedData.keyVersion
                }
            });
            mockEncryptionService.decrypt.mockResolvedValue(testFile.buffer);

            const result = await documentService.verifyDocumentWithRetry('test-doc-id');

            expect(mockVerificationService.verify).toHaveBeenCalledTimes(3);
            expect(result.verificationResult).toEqual(mockVerificationResult);
        });

        it('should handle verification service failures', async () => {
            mockDocumentModel.findById.mockResolvedValue(mockDocument);
            mockVerificationService.verify.mockRejectedValue(new Error('Service unavailable'));

            await expect(
                documentService.verifyDocumentWithRetry('test-doc-id')
            ).rejects.toThrow('Document verification failed');

            expect(mockLogger.error).toHaveBeenCalled();
        });
    });
});