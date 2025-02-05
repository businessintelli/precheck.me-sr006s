import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // @version ^29.7.0
import { container } from 'tsyringe'; // @version ^4.8.0
import supertest from 'supertest'; // @version ^6.3.3
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { ValidationError, UnauthorizedError } from '../../../utils/errors';
import { UserRole, UserStatus } from '../../../types/user.types';
import { SECURITY_CONFIG } from '../../../config/auth.config';
import { secureLogger } from '../../../utils/logger';

// Test constants
const TEST_USER = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  password: 'Test123!@#$',
  role: UserRole.HR_MANAGER,
  status: UserStatus.ACTIVE,
  organization_id: '123e4567-e89b-12d3-a456-426614174001',
  profile: {
    first_name: 'Test',
    last_name: 'User',
    phone: '+1234567890',
    timezone: 'UTC',
    mfa_enabled: true
  }
};

const TEST_TOKENS = {
  accessToken: 'test.access.token',
  refreshToken: 'test.refresh.token',
  csrfToken: 'test.csrf.token'
};

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    // Reset container and setup mocks
    container.clearInstances();

    mockAuthService = {
      login: jest.fn(),
      validateLoginAttempts: jest.fn(),
      setupMFA: jest.fn(),
      verifyMFA: jest.fn(),
      validateMFAAttempts: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      validateSession: jest.fn()
    } as any;

    container.registerInstance(AuthService, mockAuthService);
    authController = container.resolve(AuthController);

    // Setup mock request and response
    mockRequest = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: {
        'user-agent': 'test-agent',
        'x-csrf-token': TEST_TOKENS.csrfToken,
        'x-device-fingerprint': 'test-device'
      },
      cookies: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Security Tests', () => {
    it('should enforce rate limiting for login attempts', async () => {
      // Setup rate limit exceeded scenario
      mockAuthService.validateLoginAttempts.mockRejectedValue(
        new ValidationError('Rate limit exceeded', [
          { field: 'global', message: 'Too many login attempts', code: 'RATE_LIMIT_EXCEEDED' }
        ])
      );

      mockRequest.body = {
        email: TEST_USER.email,
        password: TEST_USER.password
      };

      await authController.login(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Rate limit exceeded')
        })
      );
    });

    it('should validate CSRF token for login requests', async () => {
      mockRequest.headers['x-csrf-token'] = 'invalid-token';
      mockRequest.body = {
        email: TEST_USER.email,
        password: TEST_USER.password
      };

      await authController.login(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid CSRF token')
        })
      );
    });

    it('should set secure cookies with proper attributes', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: TEST_TOKENS.accessToken,
        refreshToken: TEST_TOKENS.refreshToken,
        user: TEST_USER,
        requiresMFA: true
      });

      mockRequest.body = {
        email: TEST_USER.email,
        password: TEST_USER.password
      };

      await authController.login(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([
          expect.stringContaining('HttpOnly'),
          expect.stringContaining('Secure'),
          expect.stringContaining('SameSite=strict')
        ])
      );
    });

    it('should handle suspicious login activity', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedError('Suspicious activity detected', {
          reason: 'Unknown device and location'
        })
      );

      mockRequest.body = {
        email: TEST_USER.email,
        password: TEST_USER.password
      };

      await authController.login(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Suspicious activity detected')
        })
      );
    });
  });

  describe('MFA Security Tests', () => {
    it('should enforce rate limiting for MFA verification attempts', async () => {
      mockAuthService.validateMFAAttempts.mockRejectedValue(
        new ValidationError('Too many MFA attempts', [
          { field: 'global', message: 'MFA attempt limit exceeded', code: 'MFA_LIMIT_EXCEEDED' }
        ])
      );

      mockRequest.body = {
        token: '123456',
        sessionId: 'test-session'
      };

      await authController.verifyMFA(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Too many MFA attempts')
        })
      );
    });

    it('should validate MFA token length and format', async () => {
      mockRequest.body = {
        token: '12345', // Invalid length
        sessionId: 'test-session'
      };

      await authController.verifyMFA(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid MFA token format')
        })
      );
    });

    it('should handle MFA setup securely', async () => {
      mockAuthService.setupMFA.mockResolvedValue({
        secret: 'test-secret',
        qrCode: 'test-qr-code',
        backupCodes: ['code1', 'code2']
      });

      mockRequest.headers['x-user-id'] = TEST_USER.id;

      await authController.setupMFA(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: expect.any(String),
          qrCode: expect.any(String),
          backupCodes: expect.arrayContaining([expect.any(String)])
        })
      );
    });
  });

  describe('Session Security Tests', () => {
    it('should validate session timeout', async () => {
      mockAuthService.validateSession.mockRejectedValue(
        new UnauthorizedError('Session expired')
      );

      mockRequest.cookies.session_id = 'expired-session';

      await authController.validateSession(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Session expired')
        })
      );
    });

    it('should handle secure logout with session cleanup', async () => {
      mockRequest.cookies.session_id = 'test-session';
      mockRequest.headers['x-user-id'] = TEST_USER.id;

      await authController.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith(
        'test-session',
        'test-device'
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([
          expect.stringContaining('Max-Age=0'),
          expect.stringContaining('HttpOnly'),
          expect.stringContaining('Secure')
        ])
      );
    });

    it('should enforce secure token refresh', async () => {
      mockRequest.cookies.refresh_token = TEST_TOKENS.refreshToken;
      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
        userId: TEST_USER.id
      });

      await authController.refreshToken(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Set-Cookie',
        expect.arrayContaining([
          expect.stringContaining('new.access.token'),
          expect.stringContaining('new.refresh.token')
        ])
      );
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log security events properly', async () => {
      const logSpy = jest.spyOn(secureLogger, 'logSecurityEvent');
      
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedError('Invalid credentials')
      );

      mockRequest.body = {
        email: TEST_USER.email,
        password: 'wrong-password'
      };

      await authController.login(mockRequest, mockResponse);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOGIN_FAILURE',
          severity: 'WARNING'
        })
      );
    });

    it('should handle and log validation errors', async () => {
      const logSpy = jest.spyOn(secureLogger, 'error');

      mockRequest.body = {
        email: 'invalid-email',
        password: 'short'
      };

      await authController.login(mockRequest, mockResponse);

      expect(logSpy).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});