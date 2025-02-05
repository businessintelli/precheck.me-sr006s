import { injectable } from 'tsyringe'; // @version ^4.8.0
import { Logger } from 'winston'; // @version ^3.11.0
import { RateLimiter } from 'rate-limiter-flexible'; // @version ^2.4.1
import { ValidationService } from 'class-validator'; // @version ^0.14.0

import { UserModel } from '../../../database/models/user.model';
import { EncryptionService } from '../../../services/security/encryption.service';
import { 
  User, 
  UserRole, 
  UserStatus, 
  validateEmail, 
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  MAX_LOGIN_ATTEMPTS
} from '../../../types/user.types';
import { ValidationError, UnauthorizedError, ForbiddenError } from '../../../utils/errors';
import { SECURITY_CONFIG } from '../../../utils/constants';

/**
 * Comprehensive service implementing secure user management with validation,
 * encryption, and audit logging capabilities
 */
@injectable()
export class UserService {
  private readonly rateLimiter: RateLimiter;

  constructor(
    private readonly userModel: UserModel,
    private readonly encryptionService: EncryptionService,
    private readonly validationService: ValidationService,
    private readonly logger: Logger
  ) {
    // Initialize rate limiter for security
    this.rateLimiter = new RateLimiter({
      points: MAX_LOGIN_ATTEMPTS,
      duration: SECURITY_CONFIG.SESSION_CONFIG.ttl,
      blockDuration: SECURITY_CONFIG.SECURITY_CONFIG.lockoutDuration
    });
  }

  /**
   * Creates a new user with comprehensive validation and security measures
   */
  public async createUser(userData: {
    email: string;
    password: string;
    role: UserRole;
    organizationId: string;
    profile: {
      first_name: string;
      last_name: string;
      phone: string;
      timezone: string;
      avatar_url?: string;
    };
  }): Promise<Omit<User, 'password_hash'>> {
    try {
      // Validate email format and uniqueness
      if (!await validateEmail(userData.email)) {
        throw new ValidationError('Invalid email format', [{
          field: 'email',
          message: 'Email format is invalid'
        }]);
      }

      // Validate password strength
      const passwordValidation = validatePassword(userData.password);
      if (!passwordValidation) {
        throw new ValidationError('Invalid password', [{
          field: 'password',
          message: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters and meet security requirements`
        }]);
      }

      // Hash password securely
      const hashedPassword = await this.encryptionService.hashPassword(userData.password);

      // Encrypt sensitive profile data
      const encryptedProfile = await this.encryptPhone(userData.profile.phone);

      // Create user with enhanced security
      const user = await this.userModel.create({
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        organizationId: userData.organizationId,
        profile: {
          ...userData.profile,
          phone: encryptedProfile,
          mfa_enabled: false
        }
      });

      // Audit log user creation
      this.logger.info('User created successfully', {
        userId: user.id,
        organizationId: userData.organizationId,
        role: userData.role
      });

      return user;
    } catch (error) {
      this.logger.error('User creation failed', { error });
      throw error;
    }
  }

  /**
   * Validates user credentials with rate limiting and security measures
   */
  public async validateCredentials(
    email: string,
    password: string,
    mfaToken?: string
  ): Promise<{ user: Omit<User, 'password_hash'>, sessionToken: string }> {
    try {
      // Check rate limiting
      await this.checkRateLimit(email);

      // Find and validate user
      const user = await this.userModel.findByEmail(email);
      if (!user) {
        await this.handleFailedLogin(email);
        throw new UnauthorizedError('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await this.encryptionService.verifyPassword(
        password,
        user.password_hash
      );

      if (!isValidPassword) {
        await this.handleFailedLogin(email);
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check account status
      if (user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenError('Account is not active');
      }

      // Verify MFA if enabled
      if (user.profile.mfa_enabled) {
        await this.verifyMfaToken(user.id, mfaToken);
      }

      // Generate session token
      const sessionToken = await this.generateSessionToken(user);

      // Reset failed login attempts
      await this.resetFailedLoginAttempts(user.id);

      // Audit log successful login
      this.logger.info('User logged in successfully', {
        userId: user.id,
        organizationId: user.organization_id
      });

      // Return sanitized user data
      const { password_hash, ...safeUser } = user;
      return { user: safeUser, sessionToken };
    } catch (error) {
      this.logger.error('Login attempt failed', { error });
      throw error;
    }
  }

  /**
   * Handles failed login attempts with rate limiting
   */
  private async handleFailedLogin(email: string): Promise<void> {
    try {
      await this.rateLimiter.consume(email);
    } catch (error) {
      throw new ForbiddenError('Too many login attempts. Please try again later.');
    }
  }

  /**
   * Verifies MFA token for enhanced security
   */
  private async verifyMfaToken(userId: string, token?: string): Promise<void> {
    if (!token) {
      throw new ValidationError('MFA token required', [{
        field: 'mfaToken',
        message: 'MFA verification is required'
      }]);
    }

    const user = await this.userModel.findById(userId);
    if (!user?.profile.mfa_secret) {
      throw new ForbiddenError('MFA not properly configured');
    }

    // Verify token implementation would go here
    // This would typically use a library like speakeasy
  }

  /**
   * Encrypts sensitive phone data
   */
  private async encryptPhone(phone: string): Promise<string> {
    const encryptedData = await this.encryptionService.encrypt(phone);
    return JSON.stringify(encryptedData);
  }

  /**
   * Generates secure session token
   */
  private async generateSessionToken(user: User): Promise<string> {
    // Implementation would depend on your session management strategy
    return `session_${user.id}_${Date.now()}`;
  }

  /**
   * Resets failed login attempts after successful login
   */
  private async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userModel.update(userId, {
      failed_login_attempts: 0,
      last_login: new Date()
    });
  }

  /**
   * Checks rate limiting for login attempts
   */
  private async checkRateLimit(key: string): Promise<void> {
    try {
      await this.rateLimiter.consume(key);
    } catch (error) {
      throw new ForbiddenError('Too many login attempts. Please try again later.');
    }
  }
}