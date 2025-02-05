import { describe, beforeAll, beforeEach, it, expect, jest } from '@jest/globals'; // @version ^29.7.0
import { Request, Response } from 'express';
import { container } from 'tsyringe'; // @version ^4.8.0
import { faker } from '@faker-js/faker'; // @version ^8.0.0
import { UserController } from '../controllers/user.controller';
import { UserService } from '../services/user.service';
import { SecurityService } from '@security/service'; // @version ^1.0.0
import { AuditLogger } from '@company/audit-logger'; // @version ^1.0.0
import { UserRole, UserStatus } from '../../../types/user.types';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../utils/errors';

describe('UserController', () => {
  let userController: UserController;
  let mockUserService: jest.Mocked<UserService>;
  let mockSecurityService: jest.Mocked<SecurityService>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeAll(() => {
    // Register mocks with the DI container
    container.registerInstance('UserService', {
      createUser: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      getUsersByOrganization: jest.fn()
    });

    container.registerInstance('SecurityService', {
      checkPermission: jest.fn(),
      checkRoleAssignment: jest.fn(),
      validateToken: jest.fn()
    });

    container.registerInstance('AuditLogger', {
      log: jest.fn()
    });
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Get mock instances
    mockUserService = container.resolve('UserService');
    mockSecurityService = container.resolve('SecurityService');
    mockAuditLogger = container.resolve('AuditLogger');

    // Initialize controller
    userController = container.resolve(UserController);

    // Setup mock request and response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };

    mockRequest = {
      user: { id: faker.string.uuid() },
      params: {},
      body: {},
      query: {}
    };
  });

  describe('createUser', () => {
    const validUserData = {
      email: faker.internet.email(),
      password: 'StrongP@ssw0rd123',
      role: UserRole.HR_MANAGER,
      organizationId: faker.string.uuid(),
      profile: {
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        phone: faker.phone.number(),
        timezone: 'UTC',
        avatar_url: faker.image.url()
      }
    };

    it('should create a user when all permissions are valid', async () => {
      // Arrange
      mockRequest.body = validUserData;
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockSecurityService.checkRoleAssignment.mockResolvedValue(true);
      mockUserService.createUser.mockResolvedValue({
        id: faker.string.uuid(),
        ...validUserData,
        status: UserStatus.ACTIVE
      });

      // Act
      await userController.createUser(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockUserService.createUser).toHaveBeenCalledWith(validUserData);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user lacks creation permission', async () => {
      // Arrange
      mockRequest.body = validUserData;
      mockSecurityService.checkPermission.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.createUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user cannot assign role', async () => {
      // Arrange
      mockRequest.body = validUserData;
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockSecurityService.checkRoleAssignment.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.createUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('should validate user input data', async () => {
      // Arrange
      mockRequest.body = { ...validUserData, email: 'invalid-email' };
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockSecurityService.checkRoleAssignment.mockResolvedValue(true);

      // Act & Assert
      await expect(userController.createUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getUser', () => {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();

    it('should return user when permissions are valid', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockUserService.getUserById.mockResolvedValue({
        id: userId,
        email: faker.internet.email(),
        role: UserRole.HR_MANAGER,
        status: UserStatus.ACTIVE
      });

      // Act
      await userController.getUser(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user lacks read permission', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockSecurityService.checkPermission.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.getUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when user does not exist', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockUserService.getUserById.mockResolvedValue(null);

      // Act & Assert
      await expect(userController.getUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateUser', () => {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();
    const updateData = {
      role: UserRole.HR_MANAGER,
      status: UserStatus.ACTIVE,
      profile: {
        first_name: faker.person.firstName()
      }
    };

    it('should update user when all permissions are valid', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockRequest.body = updateData;
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockSecurityService.checkRoleAssignment.mockResolvedValue(true);
      mockUserService.updateUser.mockResolvedValue({
        id: userId,
        ...updateData
      });

      // Act
      await userController.updateUser(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockUserService.updateUser).toHaveBeenCalledWith(userId, updateData);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user lacks update permission', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockRequest.body = updateData;
      mockSecurityService.checkPermission.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.updateUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
    });

    it('should validate role change permissions', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockRequest.body = updateData;
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockSecurityService.checkRoleAssignment.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.updateUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('deleteUser', () => {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();

    it('should delete user when permissions are valid', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockUserService.deleteUser.mockResolvedValue(undefined);

      // Act
      await userController.deleteUser(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockUserService.deleteUser).toHaveBeenCalledWith(userId);
      expect(mockResponse.status).toHaveBeenCalledWith(204);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user lacks delete permission', async () => {
      // Arrange
      mockRequest.params = { id: userId, organizationId };
      mockSecurityService.checkPermission.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.deleteUser(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('getOrganizationUsers', () => {
    const organizationId = faker.string.uuid();

    it('should return users when permissions are valid', async () => {
      // Arrange
      mockRequest.params = { organizationId };
      mockRequest.query = { page: '1', limit: '20' };
      mockSecurityService.checkPermission.mockResolvedValue(true);
      mockUserService.getUsersByOrganization.mockResolvedValue({
        users: [],
        total: 0,
        page: 1,
        limit: 20
      });

      // Act
      await userController.getOrganizationUsers(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockUserService.getUsersByOrganization).toHaveBeenCalledWith(
        organizationId,
        1,
        20
      );
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when user lacks list permission', async () => {
      // Arrange
      mockRequest.params = { organizationId };
      mockSecurityService.checkPermission.mockResolvedValue(false);

      // Act & Assert
      await expect(userController.getOrganizationUsers(mockRequest as Request, mockResponse as Response))
        .rejects.toThrow(ForbiddenError);
    });

    it('should use default pagination when not provided', async () => {
      // Arrange
      mockRequest.params = { organizationId };
      mockRequest.query = {};
      mockSecurityService.checkPermission.mockResolvedValue(true);

      // Act
      await userController.getOrganizationUsers(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockUserService.getUsersByOrganization).toHaveBeenCalledWith(
        organizationId,
        1,
        20
      );
    });
  });
});