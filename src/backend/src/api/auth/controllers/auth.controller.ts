import { injectable } from 'tsyringe'; // @version ^4.8.0
import { NextApiRequest, NextApiResponse } from 'next'; // @version 14.0.0
import { csrf } from 'csrf'; // @version ^3.1.0
import { RateLimiterService } from '@nestjs/throttler'; // @version ^5.0.0
import { AuditLogService } from '@nestjs/common'; // @version ^10.0.0

import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { secureLogger } from '../../../utils/logger';
import { formatErrorResponse } from '../../../utils/errors';
import { SECURITY_CONFIG } from '../../../config/auth.config';
import { validateDTO } from '../../../utils/validators';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
} as const;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  domain: process.env.COOKIE_DOMAIN || '.precheck.me'
};

@injectable()
export class AuthController {
  private csrfTokens: csrf;

  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly auditLogService: AuditLogService
  ) {
    this.csrfTokens = new csrf();
  }

  /**
   * Handles user login with comprehensive security measures
   */
  public async login(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // Rate limiting check
      await this.rateLimiterService.checkRateLimit(req.socket.remoteAddress || '', {
        points: SECURITY_CONFIG.maxLoginAttempts,
        duration: SECURITY_CONFIG.lockoutDuration
      });

      // CSRF protection
      if (!this.csrfTokens.verify(process.env.CSRF_SECRET!, req.headers['x-csrf-token'] as string)) {
        throw new Error('Invalid CSRF token');
      }

      // Validate request body
      const loginData = await validateDTO(LoginDto, req.body, {
        rateLimit: true,
        clientId: req.socket.remoteAddress
      });

      // Attempt authentication
      const authResult = await this.authService.login({
        email: loginData.email,
        password: loginData.password,
        fingerprint: req.headers['x-device-fingerprint'] as string
      });

      // Set secure cookies
      const { accessToken, refreshToken } = authResult;
      res.setHeader('Set-Cookie', [
        `access_token=${accessToken}; ${Object.entries(COOKIE_OPTIONS).map(([k, v]) => `${k}=${v}`).join('; ')}; max-age=${SECURITY_CONFIG.jwt.expiresIn}`,
        `refresh_token=${refreshToken}; ${Object.entries(COOKIE_OPTIONS).map(([k, v]) => `${k}=${v}`).join('; ')}; max-age=${SECURITY_CONFIG.jwt.refreshExpiresIn}`
      ]);

      // Generate new CSRF token
      const newCsrfToken = this.csrfTokens.create(process.env.CSRF_SECRET!);

      // Audit logging
      await this.auditLogService.log({
        action: 'LOGIN',
        userId: authResult.user.id,
        organizationId: authResult.user.organization_id,
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(HTTP_STATUS.OK).json({
        user: authResult.user,
        csrfToken: newCsrfToken,
        requiresMFA: authResult.requiresMFA
      });
    } catch (error) {
      secureLogger.error('Login failed', {
        error,
        ip: req.socket.remoteAddress,
        email: req.body?.email
      });

      const errorResponse = formatErrorResponse(error);
      res.status(errorResponse.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Handles new user registration with security validations
   */
  public async register(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // Rate limiting check
      await this.rateLimiterService.checkRateLimit(req.socket.remoteAddress || '', {
        points: 3,
        duration: 3600
      });

      // CSRF protection
      if (!this.csrfTokens.verify(process.env.CSRF_SECRET!, req.headers['x-csrf-token'] as string)) {
        throw new Error('Invalid CSRF token');
      }

      // Validate request body
      const registerData = await validateDTO(RegisterDto, req.body, {
        rateLimit: true,
        clientId: req.socket.remoteAddress
      });

      // Create new user
      const result = await this.authService.register(registerData);

      // Generate new CSRF token
      const newCsrfToken = this.csrfTokens.create(process.env.CSRF_SECRET!);

      // Audit logging
      await this.auditLogService.log({
        action: 'REGISTER',
        userId: result.id,
        organizationId: result.organization_id,
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(HTTP_STATUS.CREATED).json({
        user: result,
        csrfToken: newCsrfToken
      });
    } catch (error) {
      secureLogger.error('Registration failed', {
        error,
        ip: req.socket.remoteAddress
      });

      const errorResponse = formatErrorResponse(error);
      res.status(errorResponse.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Handles MFA setup with secure token generation
   */
  public async setupMFA(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // Verify authentication
      const userId = req.headers['x-user-id'];
      if (!userId) {
        throw new Error('Unauthorized');
      }

      // CSRF protection
      if (!this.csrfTokens.verify(process.env.CSRF_SECRET!, req.headers['x-csrf-token'] as string)) {
        throw new Error('Invalid CSRF token');
      }

      // Setup MFA
      const mfaSetup = await this.authService.setupMFA(userId as string);

      // Audit logging
      await this.auditLogService.log({
        action: 'MFA_SETUP',
        userId: userId as string,
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(HTTP_STATUS.OK).json(mfaSetup);
    } catch (error) {
      secureLogger.error('MFA setup failed', {
        error,
        ip: req.socket.remoteAddress
      });

      const errorResponse = formatErrorResponse(error);
      res.status(errorResponse.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Verifies MFA token with rate limiting
   */
  public async verifyMFA(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // Rate limiting for MFA attempts
      await this.rateLimiterService.checkRateLimit(`mfa:${req.socket.remoteAddress}`, {
        points: 3,
        duration: 300
      });

      const { token, sessionId } = req.body;

      // Verify MFA token
      const result = await this.authService.verifyMFA(sessionId, token);

      // Audit logging
      await this.auditLogService.log({
        action: 'MFA_VERIFY',
        userId: result.userId,
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          success: result.verified
        }
      });

      res.status(HTTP_STATUS.OK).json({ verified: result.verified });
    } catch (error) {
      secureLogger.error('MFA verification failed', {
        error,
        ip: req.socket.remoteAddress
      });

      const errorResponse = formatErrorResponse(error);
      res.status(errorResponse.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Handles secure logout with session cleanup
   */
  public async logout(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // CSRF protection
      if (!this.csrfTokens.verify(process.env.CSRF_SECRET!, req.headers['x-csrf-token'] as string)) {
        throw new Error('Invalid CSRF token');
      }

      const sessionId = req.cookies.session_id;
      const deviceId = req.headers['x-device-fingerprint'];

      // Perform logout
      await this.authService.logout(sessionId, deviceId as string);

      // Clear auth cookies
      res.setHeader('Set-Cookie', [
        'access_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict',
        'refresh_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict',
        'session_id=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict'
      ]);

      // Audit logging
      await this.auditLogService.log({
        action: 'LOGOUT',
        userId: req.headers['x-user-id'] as string,
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(HTTP_STATUS.OK).json({ success: true });
    } catch (error) {
      secureLogger.error('Logout failed', {
        error,
        ip: req.socket.remoteAddress
      });

      const errorResponse = formatErrorResponse(error);
      res.status(errorResponse.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Handles secure token refresh with validation
   */
  public async refreshToken(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // Rate limiting for token refresh
      await this.rateLimiterService.checkRateLimit(`refresh:${req.socket.remoteAddress}`, {
        points: 10,
        duration: 300
      });

      const refreshToken = req.cookies.refresh_token;
      if (!refreshToken) {
        throw new Error('No refresh token provided');
      }

      // Refresh tokens
      const newTokens = await this.authService.refreshToken(refreshToken);

      // Set new secure cookies
      res.setHeader('Set-Cookie', [
        `access_token=${newTokens.accessToken}; ${Object.entries(COOKIE_OPTIONS).map(([k, v]) => `${k}=${v}`).join('; ')}; max-age=${SECURITY_CONFIG.jwt.expiresIn}`,
        `refresh_token=${newTokens.refreshToken}; ${Object.entries(COOKIE_OPTIONS).map(([k, v]) => `${k}=${v}`).join('; ')}; max-age=${SECURITY_CONFIG.jwt.refreshExpiresIn}`
      ]);

      // Generate new CSRF token
      const newCsrfToken = this.csrfTokens.create(process.env.CSRF_SECRET!);

      // Audit logging
      await this.auditLogService.log({
        action: 'TOKEN_REFRESH',
        userId: newTokens.userId,
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      });

      res.status(HTTP_STATUS.OK).json({
        csrfToken: newCsrfToken
      });
    } catch (error) {
      secureLogger.error('Token refresh failed', {
        error,
        ip: req.socket.remoteAddress
      });

      const errorResponse = formatErrorResponse(error);
      res.status(errorResponse.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}