import { injectable } from 'tsyringe'; // @version ^4.8.0
import { Request, Response } from 'express'; // @version ^4.18.0
import { Logger } from 'winston'; // @version ^3.11.0
import { z } from 'zod'; // @version ^3.22.0
import { rateLimit } from 'express-rate-limit'; // @version ^6.7.0

import { UserService } from '../services/user.service';
import { validateRequest } from '../../../middleware/validation.middleware';
import { AuthorizationService } from '@precheck/auth'; // @version ^1.0.0
import { ValidationError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import { UserRole, UserStatus, userProfileSchema } from '../../../types/user.types';
import { API_RATE_LIMITS } from '../../../utils/constants';

// Create user request schema
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  role: z.nativeEnum(UserRole),
  organizationId: z.string().uuid(),
  profile: userProfileSchema
});

// Update user request schema
const updateUserSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  profile: userProfileSchema.partial().optional()
});

/**
 * Controller handling user management operations with comprehensive security controls
 */
@injectable()
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: Logger,
    private readonly authService: AuthorizationService
  ) {}

  /**
   * Creates a new user with security validation and audit logging
   */
  @validateRequest({ body: createUserSchema })
  @rateLimit({ windowMs: 60000, max: API_RATE_LIMITS.DEFAULT })
  public async createUser(req: Request, res: Response) {
    try {
      // Verify organization-level permissions
      const canCreateUser = await this.authService.checkPermission(
        req.user!.id,
        'user:create',
        req.body.organizationId
      );

      if (!canCreateUser) {
        throw new ForbiddenError('Insufficient permissions to create user');
      }

      // Verify role assignment permissions
      const canAssignRole = await this.authService.checkRoleAssignment(
        req.user!.id,
        req.body.role,
        req.body.organizationId
      );

      if (!canAssignRole) {
        throw new ForbiddenError(`Cannot assign role ${req.body.role}`);
      }

      const user = await this.userService.createUser(req.body);

      // Audit log user creation
      this.logger.info('User created', {
        userId: user.id,
        organizationId: req.body.organizationId,
        createdBy: req.user!.id,
        role: req.body.role
      });

      return res.status(201).json(user);
    } catch (error) {
      this.logger.error('User creation failed', { error });
      throw error;
    }
  }

  /**
   * Retrieves user details with permission checks
   */
  @rateLimit({ windowMs: 60000, max: API_RATE_LIMITS.DEFAULT })
  public async getUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;

      // Verify read permissions
      const canViewUser = await this.authService.checkPermission(
        req.user!.id,
        'user:read',
        req.params.organizationId
      );

      if (!canViewUser) {
        throw new ForbiddenError('Insufficient permissions to view user');
      }

      const user = await this.userService.getUserById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return res.json(user);
    } catch (error) {
      this.logger.error('User retrieval failed', { error });
      throw error;
    }
  }

  /**
   * Updates user details with role validation
   */
  @validateRequest({ body: updateUserSchema })
  @rateLimit({ windowMs: 60000, max: API_RATE_LIMITS.DEFAULT })
  public async updateUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;

      // Verify update permissions
      const canUpdateUser = await this.authService.checkPermission(
        req.user!.id,
        'user:update',
        req.params.organizationId
      );

      if (!canUpdateUser) {
        throw new ForbiddenError('Insufficient permissions to update user');
      }

      // Additional role change validation
      if (req.body.role) {
        const canChangeRole = await this.authService.checkRoleAssignment(
          req.user!.id,
          req.body.role,
          req.params.organizationId
        );

        if (!canChangeRole) {
          throw new ForbiddenError(`Cannot assign role ${req.body.role}`);
        }
      }

      const updatedUser = await this.userService.updateUser(userId, req.body);

      // Audit log user update
      this.logger.info('User updated', {
        userId,
        organizationId: req.params.organizationId,
        updatedBy: req.user!.id,
        changes: req.body
      });

      return res.json(updatedUser);
    } catch (error) {
      this.logger.error('User update failed', { error });
      throw error;
    }
  }

  /**
   * Deletes user with security checks
   */
  @rateLimit({ windowMs: 60000, max: API_RATE_LIMITS.DEFAULT })
  public async deleteUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;

      // Verify delete permissions
      const canDeleteUser = await this.authService.checkPermission(
        req.user!.id,
        'user:delete',
        req.params.organizationId
      );

      if (!canDeleteUser) {
        throw new ForbiddenError('Insufficient permissions to delete user');
      }

      await this.userService.deleteUser(userId);

      // Audit log user deletion
      this.logger.info('User deleted', {
        userId,
        organizationId: req.params.organizationId,
        deletedBy: req.user!.id
      });

      return res.status(204).send();
    } catch (error) {
      this.logger.error('User deletion failed', { error });
      throw error;
    }
  }

  /**
   * Retrieves users for an organization with pagination
   */
  @rateLimit({ windowMs: 60000, max: API_RATE_LIMITS.DEFAULT })
  public async getOrganizationUsers(req: Request, res: Response) {
    try {
      const organizationId = req.params.organizationId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Verify list permissions
      const canListUsers = await this.authService.checkPermission(
        req.user!.id,
        'user:list',
        organizationId
      );

      if (!canListUsers) {
        throw new ForbiddenError('Insufficient permissions to list users');
      }

      const users = await this.userService.getUsersByOrganization(
        organizationId,
        page,
        limit
      );

      return res.json(users);
    } catch (error) {
      this.logger.error('Organization users retrieval failed', { error });
      throw error;
    }
  }
}