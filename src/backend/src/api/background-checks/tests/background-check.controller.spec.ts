import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals'; // @version ^29.7.0
import { container } from 'tsyringe'; // @version ^4.8.0
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'; // @version ^10.0.0

import { BackgroundCheckController } from '../controllers/background-check.controller';
import { BackgroundCheckService } from '../services/background-check.service';
import { CreateBackgroundCheckDto } from '../dto/create-check.dto';
import { BackgroundCheckType, BackgroundCheckStatus } from '../../../types/background-check.types';
import { DocumentType, DocumentStatus } from '../../../types/document.types';
import { secureLogger } from '../../../utils/logger';

describe('BackgroundCheckController', () => {
  let controller: BackgroundCheckController;
  let mockBackgroundCheckService: jest.Mocked<BackgroundCheckService>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    organizationId: '123e4567-e89b-12d3-a456-426614174001',
    role: 'HR_MANAGER'
  };

  const mockCreateCheckDto: CreateBackgroundCheckDto = {
    type: BackgroundCheckType.STANDARD,
    candidateId: '123e4567-e89b-12d3-a456-426614174002',
    organizationId: '123e4567-e89b-12d3-a456-426614174001',
    requiredDocuments: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE
    ],
    metadata: {
      requestedBy: mockUser.id,
      department: 'Engineering',
      position: 'Senior Developer',
      urgency: 'MEDIUM'
    }
  };

  beforeEach(() => {
    // Reset mocks and container
    jest.clearAllMocks();
    container.clearInstances();

    // Create mock service
    mockBackgroundCheckService = {
      createBackgroundCheck: jest.fn(),
      getBackgroundCheck: jest.fn(),
      updateBackgroundCheck: jest.fn(),
      processDocuments: jest.fn(),
      listBackgroundChecks: jest.fn()
    } as any;

    // Register mock service
    container.registerInstance(BackgroundCheckService, mockBackgroundCheckService);
    container.registerInstance('Logger', secureLogger);

    // Initialize controller
    controller = container.resolve(BackgroundCheckController);
  });

  afterEach(() => {
    jest.clearAllMocks();
    container.clearInstances();
  });

  describe('createBackgroundCheck', () => {
    it('should create background check successfully with valid input', async () => {
      const expectedResult = {
        id: '123e4567-e89b-12d3-a456-426614174003',
        ...mockCreateCheckDto,
        status: BackgroundCheckStatus.INITIATED,
        documents: [],
        interviews: [],
        verifications: [],
        results: [],
        initiatedAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days
      };

      mockBackgroundCheckService.createBackgroundCheck.mockResolvedValue(expectedResult);

      const result = await controller.createBackgroundCheck(mockCreateCheckDto);

      expect(result).toEqual(expectedResult);
      expect(mockBackgroundCheckService.createBackgroundCheck).toHaveBeenCalledWith(mockCreateCheckDto);
    });

    it('should throw BadRequestException for invalid input data', async () => {
      const invalidDto = {
        ...mockCreateCheckDto,
        type: 'INVALID_TYPE'
      };

      await expect(controller.createBackgroundCheck(invalidDto as any))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException for invalid permissions', async () => {
      mockBackgroundCheckService.createBackgroundCheck.mockRejectedValue(
        new UnauthorizedException('Insufficient permissions')
      );

      await expect(controller.createBackgroundCheck(mockCreateCheckDto))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should validate CSRF token', async () => {
      const mockReq = {
        headers: { 'csrf-token': 'invalid-token' }
      };

      await expect(controller.createBackgroundCheck(mockCreateCheckDto, mockReq as any))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('getBackgroundCheck', () => {
    const mockCheckId = '123e4567-e89b-12d3-a456-426614174003';

    it('should retrieve background check by id successfully', async () => {
      const expectedResult = {
        id: mockCheckId,
        ...mockCreateCheckDto,
        status: BackgroundCheckStatus.VERIFICATION_IN_PROGRESS,
        documents: [],
        interviews: [],
        verifications: [],
        results: [],
        initiatedAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      };

      mockBackgroundCheckService.getBackgroundCheck.mockResolvedValue(expectedResult);

      const result = await controller.getBackgroundCheck(mockCheckId);

      expect(result).toEqual(expectedResult);
      expect(mockBackgroundCheckService.getBackgroundCheck).toHaveBeenCalledWith(mockCheckId);
    });

    it('should throw NotFoundException for non-existent check', async () => {
      mockBackgroundCheckService.getBackgroundCheck.mockResolvedValue(null);

      await expect(controller.getBackgroundCheck(mockCheckId))
        .rejects
        .toThrow(NotFoundException);
    });

    it('should validate permissions before retrieval', async () => {
      mockBackgroundCheckService.getBackgroundCheck.mockRejectedValue(
        new UnauthorizedException('Insufficient permissions')
      );

      await expect(controller.getBackgroundCheck(mockCheckId))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('updateBackgroundCheckStatus', () => {
    const mockCheckId = '123e4567-e89b-12d3-a456-426614174003';

    it('should update background check status successfully', async () => {
      const newStatus = BackgroundCheckStatus.COMPLETED;
      const expectedResult = {
        id: mockCheckId,
        ...mockCreateCheckDto,
        status: newStatus,
        documents: [],
        interviews: [],
        verifications: [],
        results: [],
        initiatedAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      };

      mockBackgroundCheckService.updateBackgroundCheck.mockResolvedValue(expectedResult);

      const result = await controller.updateBackgroundCheckStatus(mockCheckId, newStatus);

      expect(result).toEqual(expectedResult);
      expect(mockBackgroundCheckService.updateBackgroundCheck)
        .toHaveBeenCalledWith(mockCheckId, { status: newStatus });
    });

    it('should throw BadRequestException for invalid status', async () => {
      await expect(controller.updateBackgroundCheckStatus(mockCheckId, 'INVALID_STATUS' as any))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should maintain audit trail for status updates', async () => {
      const newStatus = BackgroundCheckStatus.COMPLETED;
      await controller.updateBackgroundCheckStatus(mockCheckId, newStatus);

      expect(secureLogger.info).toHaveBeenCalledWith(
        'Background check status updated',
        expect.objectContaining({
          checkId: mockCheckId,
          status: newStatus
        })
      );
    });
  });

  describe('processDocuments', () => {
    const mockCheckId = '123e4567-e89b-12d3-a456-426614174003';
    const mockDocuments = [
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        type: DocumentType.GOVERNMENT_ID,
        url: 'https://storage.example.com/doc1.pdf'
      }
    ];

    it('should process documents successfully', async () => {
      const expectedResult = {
        id: mockCheckId,
        ...mockCreateCheckDto,
        status: BackgroundCheckStatus.VERIFICATION_IN_PROGRESS,
        documents: mockDocuments,
        interviews: [],
        verifications: [],
        results: [],
        initiatedAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      };

      mockBackgroundCheckService.processDocuments.mockResolvedValue(expectedResult);

      const result = await controller.processDocuments(mockCheckId, mockDocuments);

      expect(result).toEqual(expectedResult);
      expect(mockBackgroundCheckService.processDocuments)
        .toHaveBeenCalledWith(mockCheckId, mockDocuments);
    });

    it('should validate document types and sizes', async () => {
      const invalidDocuments = [
        {
          id: '123e4567-e89b-12d3-a456-426614174004',
          type: 'INVALID_TYPE',
          url: 'https://storage.example.com/doc1.pdf'
        }
      ];

      await expect(controller.processDocuments(mockCheckId, invalidDocuments))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should track document processing status', async () => {
      await controller.processDocuments(mockCheckId, mockDocuments);

      expect(secureLogger.info).toHaveBeenCalledWith(
        'Documents processed for background check',
        expect.objectContaining({
          checkId: mockCheckId,
          documentCount: mockDocuments.length
        })
      );
    });
  });

  describe('listBackgroundChecks', () => {
    const mockQuery = {
      page: 1,
      limit: 10,
      status: BackgroundCheckStatus.VERIFICATION_IN_PROGRESS
    };

    it('should list background checks with pagination', async () => {
      const expectedResult = {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174003',
            ...mockCreateCheckDto,
            status: BackgroundCheckStatus.VERIFICATION_IN_PROGRESS
          }
        ],
        total: 1,
        page: 1,
        limit: 10
      };

      mockBackgroundCheckService.listBackgroundChecks.mockResolvedValue(expectedResult);

      const result = await controller.listBackgroundChecks(mockQuery);

      expect(result).toEqual(expectedResult);
      expect(mockBackgroundCheckService.listBackgroundChecks)
        .toHaveBeenCalledWith(mockQuery);
    });

    it('should filter by organization', async () => {
      await controller.listBackgroundChecks({
        ...mockQuery,
        organizationId: mockUser.organizationId
      });

      expect(mockBackgroundCheckService.listBackgroundChecks)
        .toHaveBeenCalledWith(expect.objectContaining({
          organizationId: mockUser.organizationId
        }));
    });

    it('should validate access permissions', async () => {
      mockBackgroundCheckService.listBackgroundChecks.mockRejectedValue(
        new UnauthorizedException('Insufficient permissions')
      );

      await expect(controller.listBackgroundChecks(mockQuery))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });
});