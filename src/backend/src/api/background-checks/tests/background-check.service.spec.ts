import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mock, MockProxy, mockReset, mockClear } from 'jest-mock-extended';
import { performance } from 'perf_hooks';

import { BackgroundCheckService } from '../services/background-check.service';
import { BackgroundCheckType, BackgroundCheckStatus } from '../../../types/background-check.types';
import { DocumentType, DocumentStatus } from '../../../types/document.types';
import { BACKGROUND_CHECK_PACKAGES } from '../../../utils/constants';

describe('BackgroundCheckService', () => {
  let backgroundCheckService: BackgroundCheckService;
  let backgroundCheckModelMock: MockProxy<any>;
  let documentVerificationServiceMock: MockProxy<any>;
  let notificationServiceMock: MockProxy<any>;
  let securityServiceMock: MockProxy<any>;
  let loggerMock: MockProxy<any>;
  let cacheMock: MockProxy<any>;
  let performanceMetrics: { [key: string]: number };

  beforeEach(() => {
    // Initialize mocks
    backgroundCheckModelMock = mock();
    documentVerificationServiceMock = mock();
    notificationServiceMock = mock();
    securityServiceMock = mock();
    loggerMock = mock();
    cacheMock = mock();
    performanceMetrics = {};

    // Setup service instance
    backgroundCheckService = new BackgroundCheckService(
      backgroundCheckModelMock,
      documentVerificationServiceMock,
      notificationServiceMock,
      loggerMock,
      cacheMock
    );

    // Setup common mock implementations
    backgroundCheckModelMock.createWithTransaction.mockResolvedValue({
      id: 'test-check-id',
      status: BackgroundCheckStatus.INITIATED,
      type: BackgroundCheckType.BASIC
    });

    documentVerificationServiceMock.verifyDocumentBatch.mockResolvedValue([
      { verified: true, confidenceScore: 0.95 }
    ]);

    cacheMock.get.mockResolvedValue(null);
    cacheMock.set.mockResolvedValue('OK');
  });

  afterEach(() => {
    mockReset(backgroundCheckModelMock);
    mockReset(documentVerificationServiceMock);
    mockReset(notificationServiceMock);
    mockReset(securityServiceMock);
    mockReset(loggerMock);
    mockReset(cacheMock);
    performanceMetrics = {};
  });

  describe('createBackgroundCheck', () => {
    it('should create a background check with valid data and security validation', async () => {
      // Setup
      const startTime = performance.now();
      const testData = {
        type: BackgroundCheckType.BASIC,
        candidateId: 'test-candidate-id',
        organizationId: 'test-org-id',
        metadata: {
          requestedBy: 'test-user-id',
          department: 'HR'
        }
      };

      securityServiceMock.validateRequest.mockResolvedValue(true);

      // Execute
      const result = await backgroundCheckService.createBackgroundCheck(testData);

      // Verify
      expect(result).toBeDefined();
      expect(result.id).toBe('test-check-id');
      expect(result.status).toBe(BackgroundCheckStatus.INITIATED);
      expect(result.type).toBe(BackgroundCheckType.BASIC);

      // Verify security checks
      expect(securityServiceMock.validateRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testData.metadata.requestedBy,
          organizationId: testData.organizationId
        })
      );

      // Verify model interactions
      expect(backgroundCheckModelMock.createWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: testData.type,
          candidateId: testData.candidateId,
          organizationId: testData.organizationId
        })
      );

      // Verify notifications
      expect(notificationServiceMock.sendBackgroundCheckNotification).toHaveBeenCalledWith(
        testData.candidateId,
        expect.objectContaining({
          id: 'test-check-id',
          status: BackgroundCheckStatus.INITIATED
        })
      );

      // Verify performance
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent document uploads with race condition prevention', async () => {
      // Setup
      const documents = [
        { id: 'doc1', type: DocumentType.GOVERNMENT_ID, url: 'url1' },
        { id: 'doc2', type: DocumentType.EMPLOYMENT_RECORD, url: 'url2' }
      ];

      const checkId = 'test-check-id';
      const processingPromises = documents.map(doc => 
        backgroundCheckService.processDocuments(checkId, [doc])
      );

      // Execute
      const results = await Promise.all(processingPromises);

      // Verify
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBeTruthy();
      });

      // Verify optimistic locking was used
      expect(backgroundCheckModelMock.updateWithOptimisticLock).toHaveBeenCalled();
    });

    it('should reject invalid status transitions with proper error handling', async () => {
      // Setup
      const checkId = 'test-check-id';
      backgroundCheckModelMock.findById.mockResolvedValue({
        id: checkId,
        status: BackgroundCheckStatus.COMPLETED
      });

      // Execute & Verify
      await expect(
        backgroundCheckService.updateStatus(checkId, BackgroundCheckStatus.INITIATED)
      ).rejects.toThrow('Invalid status transition');

      // Verify error logging
      expect(loggerMock.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid status transition'),
        expect.any(Object)
      );
    });

    it('should validate document requirements based on check type', async () => {
      // Setup
      const testData = {
        type: BackgroundCheckType.COMPREHENSIVE,
        candidateId: 'test-candidate-id',
        organizationId: 'test-org-id',
        metadata: {
          requestedBy: 'test-user-id'
        }
      };

      // Execute
      const result = await backgroundCheckService.createBackgroundCheck(testData);

      // Verify required documents were created
      const requiredDocs = BACKGROUND_CHECK_PACKAGES[BackgroundCheckType.COMPREHENSIVE].required_documents;
      expect(backgroundCheckModelMock.createWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          documents: expect.arrayContaining(
            requiredDocs.map(type => expect.objectContaining({ type }))
          )
        })
      );
    });

    it('should maintain performance metrics within SLA requirements', async () => {
      // Setup
      const iterations = 100;
      const startTime = performance.now();
      const testData = {
        type: BackgroundCheckType.BASIC,
        candidateId: 'test-candidate-id',
        organizationId: 'test-org-id',
        metadata: { requestedBy: 'test-user-id' }
      };

      // Execute multiple operations
      const promises = Array(iterations).fill(null).map(() => 
        backgroundCheckService.createBackgroundCheck(testData)
      );

      await Promise.all(promises);

      // Verify performance
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;
      expect(averageTime).toBeLessThan(50); // Average operation should complete within 50ms
    });
  });
});