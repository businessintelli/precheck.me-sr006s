// @jest/globals version ^29.7.0
// jest-mock version ^29.7.0

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import type { MockInstance } from 'jest-mock';
import { OrganizationService } from '../services/organization.service';
import { OrganizationModel } from '../../../database/models/organization.model';
import { PaymentService } from '../../../integrations/payment/payment.service';
import { 
  Organization,
  OrganizationType,
  OrganizationStatus,
  OrganizationSettings,
  SUBSCRIPTION_TIERS
} from '../../../types/organization.types';
import NodeCache from 'node-cache';
import { Logger } from 'winston';

// Mock external dependencies
jest.mock('../../../database/models/organization.model');
jest.mock('../../../integrations/payment/payment.service');
jest.mock('winston');
jest.mock('node-cache');

describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  let organizationModel: jest.Mocked<OrganizationModel>;
  let paymentService: jest.Mocked<PaymentService>;
  let cache: jest.Mocked<NodeCache>;
  let logger: jest.Mocked<Logger>;

  // Test data
  const mockOrganization: Organization = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Organization',
    type: OrganizationType.BUSINESS,
    status: OrganizationStatus.ACTIVE,
    subscription_tier: 'professional',
    subscription_expires: new Date('2024-12-31'),
    settings: {
      allowed_domains: ['test.com'],
      max_users: 100,
      max_checks_per_month: 200,
      allowed_check_types: ['BASIC', 'STANDARD'],
      branding: {
        logo_url: 'https://test.com/logo.png',
        primary_color: '#000000',
        secondary_color: '#ffffff',
        company_name: 'Test Organization'
      }
    },
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    // Reset all mocks
    organizationModel = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByDomain: jest.fn(),
      updateSubscription: jest.fn()
    } as unknown as jest.Mocked<OrganizationModel>;

    paymentService = {
      createSubscription: jest.fn(),
      validatePaymentMethod: jest.fn(),
      updateSubscription: jest.fn()
    } as unknown as jest.Mocked<PaymentService>;

    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    } as unknown as jest.Mocked<NodeCache>;

    logger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    organizationService = new OrganizationService(
      organizationModel,
      paymentService,
      cache,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    const createOrgData = {
      name: 'New Organization',
      type: OrganizationType.BUSINESS,
      domain: 'neworg.com',
      subscriptionTier: 'professional',
      paymentMethodId: 'pm_123456789',
      settings: {
        max_users: 50,
        allowed_check_types: ['BASIC']
      }
    };

    it('should create a new organization successfully', async () => {
      organizationModel.findByDomain.mockResolvedValue(null);
      organizationModel.create.mockResolvedValue(mockOrganization);
      paymentService.createSubscription.mockResolvedValue(undefined);

      const result = await organizationService.createOrganization(createOrgData);

      expect(result).toEqual(mockOrganization);
      expect(organizationModel.create).toHaveBeenCalled();
      expect(paymentService.createSubscription).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('should throw error if organization domain already exists', async () => {
      organizationModel.findByDomain.mockResolvedValue(mockOrganization);

      await expect(organizationService.createOrganization(createOrgData))
        .rejects.toThrow('Organization with this domain already exists');
    });

    it('should validate organization name format', async () => {
      const invalidData = { ...createOrgData, name: '!' };
      
      await expect(organizationService.createOrganization(invalidData))
        .rejects.toThrow('Invalid organization name');
    });
  });

  describe('updateSubscription', () => {
    const subscriptionData = {
      organizationId: mockOrganization.id,
      subscriptionTier: 'enterprise' as typeof SUBSCRIPTION_TIERS[number],
      paymentMethodId: 'pm_987654321'
    };

    it('should update subscription successfully', async () => {
      organizationModel.findById.mockResolvedValue(mockOrganization);
      paymentService.validatePaymentMethod.mockResolvedValue(undefined);
      organizationModel.updateSubscription.mockResolvedValue({
        ...mockOrganization,
        subscription_tier: 'enterprise'
      });

      const result = await organizationService.updateSubscription(
        subscriptionData.organizationId,
        subscriptionData.subscriptionTier,
        subscriptionData.paymentMethodId
      );

      expect(result.subscription_tier).toBe('enterprise');
      expect(paymentService.updateSubscription).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('should throw error if organization not found', async () => {
      organizationModel.findById.mockResolvedValue(null);

      await expect(organizationService.updateSubscription(
        subscriptionData.organizationId,
        subscriptionData.subscriptionTier,
        subscriptionData.paymentMethodId
      )).rejects.toThrow('Organization not found');
    });

    it('should handle payment validation failure', async () => {
      organizationModel.findById.mockResolvedValue(mockOrganization);
      paymentService.validatePaymentMethod.mockRejectedValue(new Error('Invalid payment method'));

      await expect(organizationService.updateSubscription(
        subscriptionData.organizationId,
        subscriptionData.subscriptionTier,
        subscriptionData.paymentMethodId
      )).rejects.toThrow('Invalid payment method');
    });
  });

  describe('subscription validation', () => {
    it('should handle expired subscriptions', async () => {
      const expiredOrg = {
        ...mockOrganization,
        subscription_expires: new Date('2023-01-01')
      };
      organizationModel.findByStatus.mockResolvedValue([expiredOrg]);
      organizationModel.update.mockResolvedValue({
        ...expiredOrg,
        status: OrganizationStatus.EXPIRED
      });

      // Trigger subscription validation
      await (organizationService as any).validateSubscriptions();

      expect(organizationModel.update).toHaveBeenCalledWith(expiredOrg.id, {
        status: OrganizationStatus.EXPIRED,
        settings: expect.any(Object)
      });
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('caching behavior', () => {
    it('should use cached organization data when available', async () => {
      cache.get.mockReturnValue(mockOrganization);

      const result = await (organizationService as any).getOrganizationById(mockOrganization.id);

      expect(result).toEqual(mockOrganization);
      expect(organizationModel.findById).not.toHaveBeenCalled();
    });

    it('should fetch and cache organization data when not in cache', async () => {
      cache.get.mockReturnValue(null);
      organizationModel.findById.mockResolvedValue(mockOrganization);

      const result = await (organizationService as any).getOrganizationById(mockOrganization.id);

      expect(result).toEqual(mockOrganization);
      expect(organizationModel.findById).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      organizationModel.findByDomain.mockRejectedValue(new Error('Database error'));

      await expect(organizationService.createOrganization({
        name: 'Test Org',
        type: OrganizationType.BUSINESS,
        domain: 'test.com'
      })).rejects.toThrow('Database error');

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle payment service errors with retries', async () => {
      organizationModel.findByDomain.mockResolvedValue(null);
      organizationModel.create.mockResolvedValue(mockOrganization);
      paymentService.createSubscription.mockRejectedValueOnce(new Error('Payment error'))
        .mockResolvedValueOnce(undefined);

      const result = await organizationService.createOrganization({
        name: 'Test Org',
        type: OrganizationType.BUSINESS,
        domain: 'test.com',
        paymentMethodId: 'pm_test'
      });

      expect(result).toEqual(mockOrganization);
      expect(paymentService.createSubscription).toHaveBeenCalledTimes(2);
    });
  });
});