import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // @version ^29.7.0
import Redis from 'ioredis-mock'; // @version ^8.9.0
import { authenticator } from 'otplib'; // @version ^12.0.1
import { RateLimiter } from 'rate-limiter-flexible'; // @version ^2.4.1

import { AuthService } from '../services/auth.service';
import { EncryptionService } from '../../../services/security/encryption.service';
import { UnauthorizedError, ValidationError } from '../../../utils/errors';
import { UserRole, UserStatus } from '../../../types/user.types';
import { secureLogger } from '../../../utils/logger';

describe('AuthService', () => {
  let authService: AuthService;
  let redisMock: Redis;
  let encryptionServiceMock: jest.Mocked<EncryptionService>;
  let rateLimiterMock: jest.Mocked<RateLimiter>;

  const testUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: UserRole.HR_MANAGER,
    status: UserStatus.ACTIVE,
    organization_id: '123e4567-e89b-12d3-a456-426614174001',
    profile: {
      first_name: 'Test',
      last_name: 'User',
      phone: '+1234567890',
      avatar_url: 'https://example.com/avatar.jpg',
      timezone: 'UTC',
      mfa_enabled: false
    },
    last_login: new Date(),
    failed_login_attempts: 0,
    password_changed_at: new Date(),
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    // Initialize Redis mock
    redisMock = new Redis();

    // Initialize EncryptionService mock
    encryptionServiceMock = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn()
    } as unknown as jest.Mocked<EncryptionService>;

    // Initialize RateLimiter mock
    rateLimiterMock = {
      consume: jest.fn(),
      delete: jest.fn(),
      get: jest.fn()
    } as unknown as jest.Mocked<RateLimiter>;

    // Initialize AuthService with mocks
    authService = new AuthService(encryptionServiceMock, redisMock);
    (authService as any).rateLimiter = rateLimiterMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    redisMock.flushall();
  });

  describe('Authentication', () => {
    it('should authenticate valid credentials', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'ValidPass123!',
        device_id: 'test-device-123'
      };

      encryptionServiceMock.verifyPassword.mockResolvedValue(true);
      rateLimiterMock.consume.mockResolvedValue({ remainingPoints: 4 });

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(testUser.email);
      expect(result.requiresMFA).toBe(false);
    });

    it('should reject invalid password', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'WrongPass123!',
        device_id: 'test-device-123'
      };

      encryptionServiceMock.verifyPassword.mockResolvedValue(false);
      rateLimiterMock.consume.mockResolvedValue({ remainingPoints: 4 });

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow(UnauthorizedError);
    });

    it('should enforce rate limiting', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'ValidPass123!',
        device_id: 'test-device-123'
      };

      rateLimiterMock.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow('Rate limit exceeded');
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should setup MFA successfully', async () => {
      // Arrange
      const userId = testUser.id;
      const secret = authenticator.generateSecret();
      encryptionServiceMock.encrypt.mockResolvedValue({
        encryptedValue: 'encrypted_secret',
        iv: 'test_iv',
        authTag: 'test_tag',
        keyVersion: 'v1'
      });

      // Act
      const result = await authService.setupMFA(userId);

      // Assert
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('recoveryCodes');
      expect(result.recoveryCodes).toHaveLength(10);
    });

    it('should verify valid MFA token', async () => {
      // Arrange
      const userId = testUser.id;
      const secret = authenticator.generateSecret();
      const token = authenticator.generate(secret);

      encryptionServiceMock.decrypt.mockResolvedValue({ secret });

      // Act
      const result = await authService.verifyMFA(userId, token);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject invalid MFA token', async () => {
      // Arrange
      const userId = testUser.id;
      const secret = authenticator.generateSecret();
      const invalidToken = '123456';

      encryptionServiceMock.decrypt.mockResolvedValue({ secret });

      // Act & Assert
      await expect(authService.verifyMFA(userId, invalidToken))
        .rejects
        .toThrow(UnauthorizedError);
    });
  });

  describe('Session Management', () => {
    it('should create valid session', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const deviceId = 'test-device-123';
      const token = 'valid.jwt.token';

      // Act
      await authService.createSession(testUser.id, deviceId, token);

      // Assert
      const session = await redisMock.get(`session:${sessionId}`);
      expect(session).toBeTruthy();
    });

    it('should invalidate session on logout', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const deviceId = 'test-device-123';
      await redisMock.set(`session:${sessionId}`, JSON.stringify({
        userId: testUser.id,
        deviceId,
        token: 'valid.jwt.token'
      }));

      // Act
      await authService.logout(sessionId, deviceId);

      // Assert
      const session = await redisMock.get(`session:${sessionId}`);
      expect(session).toBeNull();
    });

    it('should refresh token successfully', async () => {
      // Arrange
      const refreshToken = 'valid.refresh.token';
      const sessionId = 'test-session-123';
      await redisMock.set(`session:${sessionId}`, JSON.stringify({
        userId: testUser.id,
        refreshToken
      }));

      // Act
      const result = await authService.refreshToken(refreshToken);

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });

  describe('Security Features', () => {
    it('should detect suspicious activity', async () => {
      // Arrange
      const credentials = {
        email: testUser.email,
        password: 'ValidPass123!',
        device_id: 'unknown-device-123',
        ip: '1.2.3.4'
      };

      // Act & Assert
      await expect(authService.login(credentials))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle session timeout', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const token = 'expired.jwt.token';

      // Act & Assert
      await expect(authService.validateSession(sessionId, token))
        .rejects
        .toThrow(UnauthorizedError);
    });

    it('should prevent token reuse', async () => {
      // Arrange
      const token = 'reused.jwt.token';
      await redisMock.sadd('token:blacklist', token);

      // Act & Assert
      await expect(authService.validateSession('test-session-123', token))
        .rejects
        .toThrow(UnauthorizedError);
    });
  });
});