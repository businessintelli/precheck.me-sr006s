import { describe, beforeAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // @version ^29.7.0
import { container } from 'tsyringe'; // @version ^4.8.0
import { faker } from '@faker-js/faker'; // @version ^8.0.0

import { UserService } from '../services/user.service';
import { UserModel } from '../../../database/models/user.model';
import { EncryptionService } from '../../../services/security/encryption.service';
import { ValidationService } from '@validation/service'; // @version ^1.0.0
import { RateLimiterService } from '@security/rate-limiter'; // @version ^1.0.0
import { AuditLogger } from '@logging/audit-logger'; // @version ^1.0.0
import { Logger } from '../../../utils/logger';

import { 
  User, 
  UserRole, 
  UserStatus, 
  UserProfile 
} from '../../../types/user.types';
import { ValidationError, UnauthorizedError, ForbiddenError } from '../../../utils/errors';
import { SECURITY_CONFIG } from '../../../utils/constants';

describe('UserService', () => {
  let userService: UserService;
  let mockUserModel: jest.Mocked<UserModel>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockValidationService: jest.Mocked<ValidationService>;
  let mockRateLimiter: jest.Mocked<RateLimiterService>;
  let mockLogger: jest.Mocked<Logger>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;

  const TEST_TIMEOUT = 5000;

  beforeAll(() => {
    // Configure test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Initialize mocked dependencies
    mockUserModel = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as unknown as jest.Mocked<UserModel>;

    mockEncryptionService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    } as unknown as jest.Mocked<EncryptionService>;

    mockValidationService = {
      validate: jest.fn()
    } as unknown as jest.Mocked<ValidationService>;

    mockRateLimiter = {
      consume: jest.fn(),
      delete: jest.fn()
    } as unknown as jest.Mocked<RateLimiterService>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockAuditLogger = {
      log: jest.fn()
    } as unknown as jest.Mocked<AuditLogger>;

    // Register mocks with DI container
    container.clearInstances();
    container.registerInstance('UserModel', mockUserModel);
    container.registerInstance('EncryptionService', mockEncryptionService);
    container.registerInstance('ValidationService', mockValidationService);
    container.registerInstance('RateLimiterService', mockRateLimiter);
    container.registerInstance('Logger', mockLogger);
    container.registerInstance('AuditLogger', mockAuditLogger);

    // Initialize service
    userService = container.resolve(UserService);
  });

  afterEach(() => {
    jest.resetAllMocks();
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

    it('should create a user with valid data', async () => {
      // Arrange
      const hashedPassword = 'hashed_password';
      const encryptedPhone = 'encrypted_phone';
      const expectedUser = {
        ...validUserData,
        id: faker.string.uuid(),
        password_hash: hashedPassword,
        status: UserStatus.PENDING_VERIFICATION
      };

      mockEncryptionService.hashPassword.mockResolvedValue(hashedPassword);
      mockEncryptionService.encrypt.mockResolvedValue(encryptedPhone);
      mockUserModel.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.createUser(validUserData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.password_hash).toBeUndefined();
      expect(mockEncryptionService.hashPassword).toHaveBeenCalledWith(validUserData.password);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(validUserData.profile.phone);
      expect(mockAuditLogger.log).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should throw ValidationError for invalid email', async () => {
      // Arrange
      const invalidUserData = {
        ...validUserData,
        email: 'invalid-email'
      };

      // Act & Assert
      await expect(userService.createUser(invalidUserData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for weak password', async () => {
      // Arrange
      const weakPasswordData = {
        ...validUserData,
        password: 'weak'
      };

      // Act & Assert
      await expect(userService.createUser(weakPasswordData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should enforce organization-based role restrictions', async () => {
      // Arrange
      const systemAdminData = {
        ...validUserData,
        role: UserRole.SYSTEM_ADMIN
      };

      // Act & Assert
      await expect(userService.createUser(systemAdminData))
        .rejects
        .toThrow(ForbiddenError);
    });
  });

  describe('validateCredentials', () => {
    const validCredentials = {
      email: faker.internet.email(),
      password: 'StrongP@ssw0rd123',
      mfaToken: '123456'
    };

    const mockUser = {
      id: faker.string.uuid(),
      email: validCredentials.email,
      password_hash: 'hashed_password',
      status: UserStatus.ACTIVE,
      profile: {
        mfa_enabled: true,
        mfa_secret: 'mfa_secret'
      }
    };

    it('should validate credentials and return session token', async () => {
      // Arrange
      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      mockEncryptionService.verifyPassword.mockResolvedValue(true);
      mockRateLimiter.consume.mockResolvedValue(undefined);

      // Act
      const result = await userService.validateCredentials(
        validCredentials.email,
        validCredentials.password,
        validCredentials.mfaToken
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.sessionToken).toBeDefined();
      expect(result.user.password_hash).toBeUndefined();
      expect(mockAuditLogger.log).toHaveBeenCalled();
    }, TEST_TIMEOUT);

    it('should enforce rate limiting on failed attempts', async () => {
      // Arrange
      mockRateLimiter.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(userService.validateCredentials(
        validCredentials.email,
        validCredentials.password
      )).rejects.toThrow(ForbiddenError);
    });

    it('should require MFA token when enabled', async () => {
      // Arrange
      mockUserModel.findByEmail.mockResolvedValue(mockUser);
      mockEncryptionService.verifyPassword.mockResolvedValue(true);

      // Act & Assert
      await expect(userService.validateCredentials(
        validCredentials.email,
        validCredentials.password
      )).rejects.toThrow(ValidationError);
    });

    it('should handle inactive user accounts', async () => {
      // Arrange
      const inactiveUser = {
        ...mockUser,
        status: UserStatus.INACTIVE
      };
      mockUserModel.findByEmail.mockResolvedValue(inactiveUser);
      mockEncryptionService.verifyPassword.mockResolvedValue(true);

      // Act & Assert
      await expect(userService.validateCredentials(
        validCredentials.email,
        validCredentials.password,
        validCredentials.mfaToken
      )).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getUsersByOrganization', () => {
    const organizationId = faker.string.uuid();

    it('should return users for valid organization', async () => {
      // Arrange
      const mockUsers = [
        {
          id: faker.string.uuid(),
          email: faker.internet.email(),
          role: UserRole.HR_MANAGER
        },
        {
          id: faker.string.uuid(),
          email: faker.internet.email(),
          role: UserRole.CANDIDATE
        }
      ];

      mockUserModel.findByOrganization = jest.fn().mockResolvedValue(mockUsers);

      // Act
      const result = await userService.getUsersByOrganization(organizationId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].password_hash).toBeUndefined();
      expect(mockUserModel.findByOrganization).toHaveBeenCalledWith(organizationId);
    });

    it('should enforce organization-based access control', async () => {
      // Arrange
      mockUserModel.findByOrganization = jest.fn().mockResolvedValue([]);

      // Act & Assert
      await expect(userService.getUsersByOrganization('invalid-org-id'))
        .rejects
        .toThrow(ForbiddenError);
    });
  });

  // Additional test suites would continue with similar patterns for:
  // - updateUser
  // - deleteUser
  // - password reset functionality
  // - MFA management
  // - Role-based access control
  // - Organization-based permissions
  // - Rate limiting
  // - Audit logging
});