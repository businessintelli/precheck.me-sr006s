// @package jest version ^29.7.0
// @package supertest version ^6.3.3
// @package express version ^4.18.0

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { Request, Response } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { OrganizationService } from '../services/organization.service';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { validateDTO } from '../../../middleware/validation.middleware';
import { UserRole } from '../../../types/user.types';
import { OrganizationType, OrganizationStatus } from '../../../types/organization.types';

// Mock implementations
jest.mock('../services/organization.service');
jest.mock('../../../middleware/validation.middleware');
jest.mock('winston', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn()
  }))
}));

describe('OrganizationController', () => {
  let organizationController: OrganizationController;
  let mockOrganizationService: jest.Mocked<OrganizationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockOrganizationService = {
      createOrganization: jest.fn(),
      getOrganization: jest.fn(),
      updateOrganization: jest.fn(),
      deleteOrganization: jest.fn(),
      updateSubscription: jest.fn(),
      auditOrganizationAccess: jest.fn(),
      validateSubscriptionUpdate: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    mockRequest = {
      user: {
        id: 'user-123',
        role: UserRole.SYSTEM_ADMIN
      },
      params: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    organizationController = new OrganizationController(
      mockOrganizationService,
      mockLogger
    );
  });

  describe('createOrganization', () => {
    const validOrganizationData = {
      name: 'Test Organization',
      type: OrganizationType.BUSINESS,
      subscription_tier: 'professional',
      allowed_domains: ['test.com'],
      branding: {
        logo_url: 'https://test.com/logo.png',
        primary_color: '#000000',
        secondary_color: '#ffffff',
        company_name: 'Test Company'
      }
    };

    it('should create organization successfully with valid data and admin role', async () => {
      const createdOrg = {
        id: 'org-123',
        ...validOrganizationData,
        status: OrganizationStatus.ACTIVE
      };

      (validateDTO as jest.Mock).mockResolvedValueOnce(validOrganizationData);
      mockOrganizationService.createOrganization.mockResolvedValueOnce(createdOrg);

      await organizationController['createOrganization'](
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: createdOrg
      });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should reject creation for non-admin users', async () => {
      mockRequest.user = { ...mockRequest.user, role: UserRole.HR_MANAGER };

      await expect(
        organizationController['createOrganization'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('should handle validation errors during creation', async () => {
      (validateDTO as jest.Mock).mockRejectedValueOnce(
        new ValidationError('Invalid input', [
          { field: 'name', message: 'Name is required' }
        ])
      );

      await expect(
        organizationController['createOrganization'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getOrganization', () => {
    const orgId = 'org-123';
    const organization = {
      id: orgId,
      name: 'Test Organization',
      status: OrganizationStatus.ACTIVE
    };

    it('should retrieve organization successfully with valid access', async () => {
      mockRequest.params = { id: orgId };
      mockOrganizationService.auditOrganizationAccess.mockResolvedValueOnce(undefined);
      mockOrganizationService.getOrganization.mockResolvedValueOnce(organization);

      await organizationController['getOrganization'](
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: organization
      });
    });

    it('should handle non-existent organizations', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockOrganizationService.getOrganization.mockResolvedValueOnce(null);

      await expect(
        organizationController['getOrganization'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('should enforce tenant isolation', async () => {
      mockRequest.params = { id: orgId };
      mockOrganizationService.auditOrganizationAccess.mockRejectedValueOnce(
        new ForbiddenError('Access denied')
      );

      await expect(
        organizationController['getOrganization'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('updateOrganization', () => {
    const orgId = 'org-123';
    const updateData = {
      name: 'Updated Organization',
      settings: { max_users: 10 }
    };

    it('should update organization successfully with admin access', async () => {
      mockRequest.params = { id: orgId };
      mockRequest.body = updateData;
      mockOrganizationService.auditOrganizationAccess.mockResolvedValueOnce(undefined);
      mockOrganizationService.updateOrganization.mockResolvedValueOnce({
        id: orgId,
        ...updateData
      });

      await organizationController['updateOrganization'](
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining(updateData)
      });
    });

    it('should reject updates from unauthorized users', async () => {
      mockRequest.user = { ...mockRequest.user, role: UserRole.CANDIDATE };

      await expect(
        organizationController['updateOrganization'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('updateSubscription', () => {
    const orgId = 'org-123';
    const subscriptionData = {
      subscription_tier: 'enterprise',
      payment_method_id: 'pm_123'
    };

    it('should update subscription successfully with valid data', async () => {
      mockRequest.params = { id: orgId };
      mockRequest.body = subscriptionData;
      mockOrganizationService.validateSubscriptionUpdate.mockResolvedValueOnce(undefined);
      mockOrganizationService.updateSubscription.mockResolvedValueOnce({
        id: orgId,
        subscription_tier: subscriptionData.subscription_tier
      });

      await organizationController['updateSubscription'](
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining({
          subscription_tier: subscriptionData.subscription_tier
        })
      });
    });

    it('should validate subscription tier and payment method', async () => {
      mockRequest.params = { id: orgId };
      mockRequest.body = { subscription_tier: 'invalid' };
      mockOrganizationService.validateSubscriptionUpdate.mockRejectedValueOnce(
        new ValidationError('Invalid subscription tier', [])
      );

      await expect(
        organizationController['updateSubscription'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteOrganization', () => {
    const orgId = 'org-123';

    it('should delete organization successfully with system admin access', async () => {
      mockRequest.params = { id: orgId };
      mockOrganizationService.deleteOrganization.mockResolvedValueOnce(undefined);

      await organizationController['deleteOrganization'](
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Organization deleted',
        expect.any(Object)
      );
    });

    it('should reject deletion from non-system admin users', async () => {
      mockRequest.user = { ...mockRequest.user, role: UserRole.COMPANY_ADMIN };
      mockRequest.params = { id: orgId };

      await expect(
        organizationController['deleteOrganization'](
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });
});