// @package express version ^4.18.0
// @package express-rate-limit version ^6.7.0
// @package winston version ^3.11.0

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Logger } from 'winston';
import { OrganizationService } from '../services/organization.service';
import { validateBody } from '../../../middleware/validation.middleware';
import { validateCreateOrganizationDto, CreateOrganizationDto } from '../dto/create-organization.dto';
import { API_RATE_LIMITS } from '../../../utils/constants';
import { 
  ValidationError, 
  UnauthorizedError, 
  ForbiddenError, 
  NotFoundError 
} from '../../../utils/errors';
import { UserRole } from '../../../types/user.types';

/**
 * Rate limiter for organization endpoints
 */
const organizationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: API_RATE_LIMITS.DEFAULT,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Controller handling organization-related HTTP endpoints with comprehensive
 * security, validation, and audit logging
 */
export class OrganizationController {
  private readonly router: Router;
  private readonly logger: Logger;

  constructor(
    private readonly organizationService: OrganizationService,
    logger: Logger
  ) {
    this.router = Router();
    this.logger = logger;
    this.initializeRoutes();
  }

  /**
   * Initializes controller routes with security middleware
   */
  private initializeRoutes(): void {
    // Apply rate limiting to all organization routes
    this.router.use(organizationRateLimiter);

    // Organization CRUD endpoints
    this.router.post(
      '/',
      validateBody(CreateOrganizationDto),
      this.createOrganization.bind(this)
    );

    this.router.get(
      '/:id',
      this.getOrganization.bind(this)
    );

    this.router.patch(
      '/:id',
      this.updateOrganization.bind(this)
    );

    this.router.delete(
      '/:id',
      this.deleteOrganization.bind(this)
    );

    // Subscription management endpoints
    this.router.post(
      '/:id/subscription',
      this.updateSubscription.bind(this)
    );
  }

  /**
   * Creates a new organization with comprehensive validation and security checks
   */
  private async createOrganization(req: Request, res: Response): Promise<void> {
    try {
      // Validate user authorization
      if (!req.user || req.user.role !== UserRole.SYSTEM_ADMIN) {
        throw new ForbiddenError('Only system administrators can create organizations');
      }

      // Validate and sanitize input
      const validatedData = await validateCreateOrganizationDto(req.body);

      // Create organization with audit trail
      const organization = await this.organizationService.createOrganization({
        name: validatedData.name,
        type: validatedData.type,
        subscription_tier: validatedData.subscription_tier,
        settings: {
          allowed_domains: validatedData.allowed_domains,
          branding: validatedData.branding,
          max_users: 5, // Default initial value
          max_checks_per_month: 10, // Default initial value
          allowed_check_types: ['BASIC'] // Default initial value
        }
      });

      this.logger.info('Organization created successfully', {
        organizationId: organization.id,
        userId: req.user.id,
        action: 'create_organization'
      });

      res.status(201).json({
        status: 'success',
        data: organization
      });
    } catch (error) {
      this.logger.error('Failed to create organization', {
        error,
        userId: req.user?.id,
        action: 'create_organization'
      });
      throw error;
    }
  }

  /**
   * Retrieves organization details with security checks and audit logging
   */
  private async getOrganization(req: Request, res: Response): Promise<void> {
    try {
      // Validate user has access to organization
      await this.organizationService.auditOrganizationAccess(req.params.id, req.user.id);

      const organization = await this.organizationService.getOrganization(req.params.id);
      if (!organization) {
        throw new NotFoundError('Organization not found');
      }

      this.logger.info('Organization retrieved', {
        organizationId: req.params.id,
        userId: req.user.id,
        action: 'get_organization'
      });

      res.json({
        status: 'success',
        data: organization
      });
    } catch (error) {
      this.logger.error('Failed to retrieve organization', {
        error,
        organizationId: req.params.id,
        userId: req.user?.id,
        action: 'get_organization'
      });
      throw error;
    }
  }

  /**
   * Updates organization details with validation and security checks
   */
  private async updateOrganization(req: Request, res: Response): Promise<void> {
    try {
      // Validate user has admin access to organization
      if (![UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN].includes(req.user.role)) {
        throw new ForbiddenError('Insufficient permissions to update organization');
      }

      await this.organizationService.auditOrganizationAccess(req.params.id, req.user.id);

      const organization = await this.organizationService.updateOrganization(
        req.params.id,
        req.body
      );

      this.logger.info('Organization updated', {
        organizationId: req.params.id,
        userId: req.user.id,
        action: 'update_organization'
      });

      res.json({
        status: 'success',
        data: organization
      });
    } catch (error) {
      this.logger.error('Failed to update organization', {
        error,
        organizationId: req.params.id,
        userId: req.user?.id,
        action: 'update_organization'
      });
      throw error;
    }
  }

  /**
   * Deletes an organization with security checks and audit logging
   */
  private async deleteOrganization(req: Request, res: Response): Promise<void> {
    try {
      // Only system admins can delete organizations
      if (req.user.role !== UserRole.SYSTEM_ADMIN) {
        throw new ForbiddenError('Only system administrators can delete organizations');
      }

      await this.organizationService.deleteOrganization(req.params.id);

      this.logger.info('Organization deleted', {
        organizationId: req.params.id,
        userId: req.user.id,
        action: 'delete_organization'
      });

      res.status(204).send();
    } catch (error) {
      this.logger.error('Failed to delete organization', {
        error,
        organizationId: req.params.id,
        userId: req.user?.id,
        action: 'delete_organization'
      });
      throw error;
    }
  }

  /**
   * Updates organization subscription with validation and fraud prevention
   */
  private async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      // Validate user has admin access
      if (![UserRole.SYSTEM_ADMIN, UserRole.COMPANY_ADMIN].includes(req.user.role)) {
        throw new ForbiddenError('Insufficient permissions to update subscription');
      }

      // Validate subscription update request
      await this.organizationService.validateSubscriptionUpdate(
        req.params.id,
        req.body.subscription_tier,
        req.body.payment_method_id
      );

      const organization = await this.organizationService.updateSubscription(
        req.params.id,
        req.body.subscription_tier,
        req.body.payment_method_id
      );

      this.logger.info('Organization subscription updated', {
        organizationId: req.params.id,
        userId: req.user.id,
        subscription: req.body.subscription_tier,
        action: 'update_subscription'
      });

      res.json({
        status: 'success',
        data: organization
      });
    } catch (error) {
      this.logger.error('Failed to update subscription', {
        error,
        organizationId: req.params.id,
        userId: req.user?.id,
        action: 'update_subscription'
      });
      throw error;
    }
  }

  /**
   * Returns the configured router for this controller
   */
  public getRouter(): Router {
    return this.router;
  }
}