// @package winston version ^3.11.0
// @package node-cache version ^5.1.2

import { Logger } from 'winston';
import NodeCache from 'node-cache';
import { OrganizationModel } from '../../../database/models/organization.model';
import { 
  Organization,
  OrganizationType,
  OrganizationStatus,
  OrganizationSettings,
  SubscriptionTier,
  validateOrganizationName,
  validateOrganizationDomain
} from '../../../types/organization.types';
import { PaymentService } from '../../../integrations/payment/payment.service';

// Constants for service configuration
const DEFAULT_SUBSCRIPTION_TIER = 'STARTUP';
const SUBSCRIPTION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL = 3600; // 1 hour
const MAX_RETRIES = 3;

/**
 * Comprehensive service for managing organizations with secure multi-tenant support
 */
export class OrganizationService {
  private readonly organizationModel: OrganizationModel;
  private readonly paymentService: PaymentService;
  private readonly cache: NodeCache;
  private readonly logger: Logger;

  constructor(
    organizationModel: OrganizationModel,
    paymentService: PaymentService,
    cache: NodeCache,
    logger: Logger
  ) {
    this.organizationModel = organizationModel;
    this.paymentService = paymentService;
    this.cache = cache;
    this.logger = logger;

    // Initialize subscription validation interval
    setInterval(() => this.validateSubscriptions(), SUBSCRIPTION_CHECK_INTERVAL);
  }

  /**
   * Creates a new organization with comprehensive validation and security checks
   */
  async createOrganization(data: {
    name: string;
    type: OrganizationType;
    domain: string;
    subscriptionTier?: SubscriptionTier;
    paymentMethodId?: string;
    settings?: Partial<OrganizationSettings>;
  }): Promise<Organization> {
    try {
      // Validate organization name and domain
      if (!validateOrganizationName(data.name)) {
        throw new Error('Invalid organization name');
      }
      if (!validateOrganizationDomain(data.domain)) {
        throw new Error('Invalid domain format');
      }

      // Check for existing organization with same name or domain
      const existingOrg = await this.organizationModel.findByDomain(data.domain);
      if (existingOrg) {
        throw new Error('Organization with this domain already exists');
      }

      // Set default subscription tier if not provided
      const subscriptionTier = data.subscriptionTier || DEFAULT_SUBSCRIPTION_TIER;

      // Initialize organization settings
      const settings: OrganizationSettings = {
        allowed_domains: [data.domain],
        max_users: 5,
        max_checks_per_month: 10,
        allowed_check_types: ['BASIC'],
        branding: {
          logo_url: '',
          primary_color: '#000000',
          secondary_color: '#ffffff',
          company_name: data.name
        },
        ...data.settings
      };

      // Create organization record
      const organization = await this.organizationModel.create({
        name: data.name,
        type: data.type,
        status: OrganizationStatus.ACTIVE,
        subscription_tier: subscriptionTier,
        subscription_expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        settings,
        domain: data.domain
      });

      // Set up subscription if payment method provided
      if (data.paymentMethodId) {
        await this.setupSubscription(organization.id, subscriptionTier, data.paymentMethodId);
      }

      // Cache organization data
      this.cacheOrganization(organization);

      this.logger.info('Organization created successfully', {
        organizationId: organization.id,
        name: organization.name,
        type: organization.type
      });

      return organization;
    } catch (error) {
      this.logger.error('Failed to create organization', { error });
      throw error;
    }
  }

  /**
   * Updates organization subscription with comprehensive validation
   */
  async updateSubscription(
    organizationId: string,
    subscriptionTier: SubscriptionTier,
    paymentMethodId: string
  ): Promise<Organization> {
    try {
      // Validate organization exists
      const organization = await this.getOrganizationById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      // Validate payment method
      await this.paymentService.validatePaymentMethod(paymentMethodId);

      // Update subscription in payment service
      await this.paymentService.updateSubscription(
        organizationId,
        subscriptionTier,
        paymentMethodId
      );

      // Update organization subscription details
      const updatedOrg = await this.organizationModel.updateSubscription(
        organizationId,
        subscriptionTier,
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year subscription
      );

      // Update cache
      this.cacheOrganization(updatedOrg);

      this.logger.info('Organization subscription updated', {
        organizationId,
        subscriptionTier
      });

      return updatedOrg;
    } catch (error) {
      this.logger.error('Failed to update subscription', {
        error,
        organizationId,
        subscriptionTier
      });
      throw error;
    }
  }

  /**
   * Retrieves organization by ID with caching
   */
  private async getOrganizationById(id: string): Promise<Organization | null> {
    // Check cache first
    const cached = this.cache.get<Organization>(this.getCacheKey(id));
    if (cached) {
      return cached;
    }

    // Fetch from database
    const organization = await this.organizationModel.findById(id);
    if (organization) {
      this.cacheOrganization(organization);
    }

    return organization;
  }

  /**
   * Validates all active subscriptions
   */
  private async validateSubscriptions(): Promise<void> {
    try {
      const organizations = await this.organizationModel.findByStatus(OrganizationStatus.ACTIVE);
      
      for (const org of organizations) {
        if (new Date(org.subscription_expires) <= new Date()) {
          await this.handleExpiredSubscription(org.id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to validate subscriptions', { error });
    }
  }

  /**
   * Handles expired subscription
   */
  private async handleExpiredSubscription(organizationId: string): Promise<void> {
    try {
      await this.organizationModel.update(organizationId, {
        status: OrganizationStatus.EXPIRED,
        settings: {
          max_users: 1,
          max_checks_per_month: 0,
          allowed_check_types: []
        }
      });

      this.logger.warn('Organization subscription expired', { organizationId });
    } catch (error) {
      this.logger.error('Failed to handle expired subscription', {
        error,
        organizationId
      });
    }
  }

  /**
   * Sets up initial subscription with payment service
   */
  private async setupSubscription(
    organizationId: string,
    subscriptionTier: SubscriptionTier,
    paymentMethodId: string
  ): Promise<void> {
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        await this.paymentService.createSubscription(
          organizationId,
          subscriptionTier,
          paymentMethodId
        );
        return;
      } catch (error) {
        retries++;
        if (retries === MAX_RETRIES) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      }
    }
  }

  /**
   * Caches organization data
   */
  private cacheOrganization(organization: Organization): void {
    this.cache.set(
      this.getCacheKey(organization.id),
      organization,
      CACHE_TTL
    );
  }

  /**
   * Generates cache key for organization
   */
  private getCacheKey(organizationId: string): string {
    return `org:${organizationId}`;
  }
}