import { PrismaClient } from '@prisma/client'; // @version ^5.4.0
import bcrypt from 'bcryptjs'; // @version ^2.4.3
import speakeasy from 'speakeasy'; // @version ^2.0.0
import { RateLimiterFlexible } from 'rate-limiter-flexible'; // @version ^2.4.1

import {
  User,
  UserRole,
  UserStatus,
  UserProfile,
  validateEmail,
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  MAX_LOGIN_ATTEMPTS
} from '../../types/user.types';

import { ValidationError, UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { SECURITY_CONFIG } from '../../utils/constants';

/**
 * Enhanced UserModel for secure user management with comprehensive features
 */
export class UserModel {
  private prisma: PrismaClient;
  private readonly tableName = 'users';
  private rateLimiter: RateLimiterFlexible;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'minimal',
    });

    // Initialize rate limiter for authentication attempts
    this.rateLimiter = new RateLimiterFlexible({
      points: MAX_LOGIN_ATTEMPTS,
      duration: 3600, // 1 hour window
      blockDuration: 1800, // 30 minutes block
      keyPrefix: 'login_attempts',
    });
  }

  /**
   * Creates a new user with enhanced security features
   * @param data User creation data with security parameters
   */
  async create(data: {
    email: string;
    password: string;
    role: UserRole;
    organizationId: string;
    profile: Omit<UserProfile, 'mfa_enabled' | 'mfa_secret'>;
  }): Promise<Omit<User, 'password_hash'>> {
    // Validate email format and domain
    if (!await validateEmail(data.email)) {
      throw new ValidationError('Invalid email format', [{
        field: 'email',
        message: 'Email format is invalid or domain is not allowed'
      }]);
    }

    // Validate password strength
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
      throw new ValidationError('Invalid password', [{
        field: 'password',
        message: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters and meet security requirements`
      }]);
    }

    // Check for existing user
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new ValidationError('User already exists', [{
        field: 'email',
        message: 'Email is already registered'
      }]);
    }

    // Generate password hash with security settings
    const passwordHash = await bcrypt.hash(
      data.password,
      SECURITY_CONFIG.PASSWORD_MIN_LENGTH
    );

    // Generate MFA secret
    const mfaSecret = speakeasy.generateSecret({
      length: 32,
      name: `Precheck.me:${data.email}`
    });

    // Create user with enhanced security features
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password_hash: passwordHash,
        role: data.role,
        status: UserStatus.PENDING_VERIFICATION,
        organization_id: data.organizationId,
        profile: {
          ...data.profile,
          mfa_enabled: false,
          mfa_secret: mfaSecret.base32
        },
        failed_login_attempts: 0,
        password_changed_at: new Date(),
        last_login: null
      }
    });

    // Exclude sensitive data from return
    const { password_hash, profile: { mfa_secret, ...safeProfile }, ...safeUser } = user;
    return {
      ...safeUser,
      profile: safeProfile
    };
  }

  /**
   * Validates user credentials with MFA and security checks
   */
  async validateCredentials(
    email: string,
    password: string,
    mfaToken?: string
  ): Promise<{ user: Omit<User, 'password_hash'>, sessionToken: string }> {
    try {
      // Check rate limiting
      await this.rateLimiter.consume(email);

      const user = await this.prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check account status
      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenError('Account is not active');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        await this.incrementFailedAttempts(user.id);
        throw new UnauthorizedError('Invalid credentials');
      }

      // Verify MFA if enabled
      if (user.profile.mfa_enabled) {
        if (!mfaToken) {
          throw new ValidationError('MFA token required', [{
            field: 'mfaToken',
            message: 'MFA verification is required'
          }]);
        }

        const isValidToken = speakeasy.totp.verify({
          secret: user.profile.mfa_secret!,
          encoding: 'base32',
          token: mfaToken,
          window: SECURITY_CONFIG.MFA_CONFIG.window
        });

        if (!isValidToken) {
          throw new UnauthorizedError('Invalid MFA token');
        }
      }

      // Update login history
      await this.updateLoginHistory(user.id);

      // Generate session token
      const sessionToken = await this.generateSessionToken(user);

      // Return safe user object
      const { password_hash, profile: { mfa_secret, ...safeProfile }, ...safeUser } = user;
      return {
        user: {
          ...safeUser,
          profile: safeProfile
        },
        sessionToken
      };
    } catch (error) {
      if (error instanceof RateLimiterFlexible.Error) {
        throw new ForbiddenError('Too many login attempts. Please try again later.');
      }
      throw error;
    }
  }

  /**
   * Sets up MFA for a user account
   */
  async setupMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ValidationError('User not found', [{
        field: 'userId',
        message: 'Invalid user ID'
      }]);
    }

    const secret = speakeasy.generateSecret({
      length: 32,
      name: `Precheck.me:${user.email}`
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          ...user.profile,
          mfa_secret: secret.base32
        }
      }
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url!
    };
  }

  /**
   * Updates user login history and security metrics
   */
  private async updateLoginHistory(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        last_login: new Date(),
        failed_login_attempts: 0
      }
    });
  }

  /**
   * Increments failed login attempts and handles account locking
   */
  private async incrementFailedAttempts(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (user) {
      const failedAttempts = user.failed_login_attempts + 1;
      const status = failedAttempts >= MAX_LOGIN_ATTEMPTS
        ? UserStatus.SUSPENDED
        : user.status;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failed_login_attempts: failedAttempts,
          status
        }
      });
    }
  }

  /**
   * Generates a secure session token
   */
  private async generateSessionToken(user: User): Promise<string> {
    // Implementation would depend on your session management strategy
    // This is a placeholder for the actual implementation
    return `session_${user.id}_${Date.now()}`;
  }
}

export default UserModel;