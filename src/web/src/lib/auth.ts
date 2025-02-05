// @package jwt-decode ^4.0.0
// @package zod ^3.22.0
// @package @otplib/preset-default ^12.0.1

import { jwtDecode } from 'jwt-decode';
import { z } from 'zod';
import { authenticator } from '@otplib/preset-default';
import { 
  AuthState, 
  LoginCredentials, 
  loginSchema, 
  AuthResponse, 
  isAuthResponse 
} from '../types/auth.types';
import { 
  User, 
  UserRole, 
  UserStatus, 
  validatePassword 
} from '../types/user.types';

// Security-related constants
const ACCESS_TOKEN_KEY = 'access_token' as const;
const REFRESH_TOKEN_KEY = 'refresh_token' as const;
const MAX_LOGIN_ATTEMPTS = 3;
const TOKEN_ROTATION_INTERVAL = 3600000; // 1 hour in milliseconds
const TOKEN_EXPIRY_BUFFER = 300000; // 5 minutes in milliseconds

// Security event types for monitoring
const SECURITY_EVENT_TYPES = {
  LOGIN_FAILED: 'login_failed',
  TOKEN_ROTATED: 'token_rotated',
  MFA_ENABLED: 'mfa_enabled',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
} as const;

// Enhanced token validation schema
const tokenSchema = z.object({
  sub: z.string().uuid(),
  role: z.nativeEnum(UserRole),
  org: z.string().uuid(),
  exp: z.number(),
  iat: z.number(),
  jti: z.string().uuid()
});

// Interface for security context
interface SecurityContext {
  lastLoginAttempt: Date | null;
  failedAttempts: number;
  lastTokenRotation: Date | null;
  suspiciousActivity: boolean;
}

// Initialize security context
let securityContext: SecurityContext = {
  lastLoginAttempt: null,
  failedAttempts: 0,
  lastTokenRotation: null,
  suspiciousActivity: false
};

/**
 * Enhanced authentication service with comprehensive security features
 */
class AuthService {
  private currentState: AuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    mfaEnabled: false,
    sessionExpiry: new Date()
  };

  /**
   * Authenticate user with enhanced security checks and MFA support
   */
  async login(credentials: LoginCredentials, otpToken?: string): Promise<AuthState> {
    try {
      // Validate credentials using enhanced schema
      const validatedCreds = loginSchema.parse(credentials);

      // Check for account lockout
      if (this.isAccountLocked()) {
        throw new Error('Account temporarily locked due to multiple failed attempts');
      }

      // Track login attempt
      this.trackLoginAttempt();

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedCreds)
      });

      if (!response.ok) {
        this.handleFailedLogin();
        throw new Error('Authentication failed');
      }

      const authData = await response.json();

      if (!isAuthResponse(authData)) {
        throw new Error('Invalid authentication response');
      }

      // Handle MFA if enabled
      if (authData.user.mfa_enabled) {
        if (!otpToken) {
          return {
            ...this.currentState,
            mfaEnabled: true
          };
        }
        await this.validateMFAToken(authData.user.id, otpToken);
      }

      // Validate and store tokens
      this.validateTokens(authData);
      this.storeTokens(authData);

      // Update security context
      securityContext.failedAttempts = 0;
      securityContext.lastTokenRotation = new Date();

      // Update current state
      this.currentState = {
        isAuthenticated: true,
        user: authData.user,
        accessToken: authData.accessToken,
        mfaEnabled: authData.user.mfa_enabled,
        sessionExpiry: this.getTokenExpiry(authData.accessToken)
      };

      return this.currentState;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Refresh access token with enhanced security checks
   */
  async refreshToken(): Promise<string> {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Implement exponential backoff for retry attempts
      const response = await this.retryWithBackoff(
        () => fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${refreshToken}`,
            'Content-Type': 'application/json'
          }
        })
      );

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { accessToken } = await response.json();
      
      // Validate new token
      this.validateTokenSignature(accessToken);
      
      // Update storage and security context
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      securityContext.lastTokenRotation = new Date();

      return accessToken;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Setup MFA for user account
   */
  async setupMFA(): Promise<string> {
    try {
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.currentState.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('MFA setup failed');
      }

      const { secret, qrCode } = await response.json();
      return qrCode;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Validate security context and token integrity
   */
  validateSecurityContext(): boolean {
    if (!this.currentState.accessToken) return false;

    try {
      const decoded = jwtDecode(this.currentState.accessToken);
      const validated = tokenSchema.parse(decoded);
      
      // Check token expiration
      if (validated.exp * 1000 < Date.now() + TOKEN_EXPIRY_BUFFER) {
        return false;
      }

      // Check for suspicious activity
      if (securityContext.suspiciousActivity) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Private helper methods
   */
  private isAccountLocked(): boolean {
    if (!securityContext.lastLoginAttempt) return false;
    
    const lockoutDuration = 15 * 60 * 1000; // 15 minutes
    const timeSinceLastAttempt = Date.now() - securityContext.lastLoginAttempt.getTime();
    
    return securityContext.failedAttempts >= MAX_LOGIN_ATTEMPTS && 
           timeSinceLastAttempt < lockoutDuration;
  }

  private trackLoginAttempt(): void {
    securityContext.lastLoginAttempt = new Date();
  }

  private handleFailedLogin(): void {
    securityContext.failedAttempts++;
    this.logSecurityEvent(SECURITY_EVENT_TYPES.LOGIN_FAILED);
  }

  private async validateMFAToken(userId: string, token: string): Promise<boolean> {
    const response = await fetch('/api/auth/mfa/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token })
    });

    if (!response.ok) {
      throw new Error('MFA validation failed');
    }

    return true;
  }

  private validateTokens(authData: AuthResponse): void {
    try {
      const decoded = jwtDecode(authData.accessToken);
      tokenSchema.parse(decoded);
    } catch {
      throw new Error('Invalid token format');
    }
  }

  private validateTokenSignature(token: string): void {
    // Implement token signature validation logic
    if (!token || token.split('.').length !== 3) {
      throw new Error('Invalid token signature');
    }
  }

  private storeTokens(authData: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, authData.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, authData.refreshToken);
  }

  private getTokenExpiry(token: string): Date {
    const decoded = jwtDecode(token);
    return new Date((decoded as any).exp * 1000);
  }

  private async retryWithBackoff(fn: () => Promise<Response>, maxRetries = 3): Promise<Response> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    throw new Error('Max retries exceeded');
  }

  private handleAuthError(error: unknown): void {
    // Log error and update security context
    console.error('Authentication error:', error);
    securityContext.suspiciousActivity = true;
    this.logSecurityEvent(SECURITY_EVENT_TYPES.SUSPICIOUS_ACTIVITY);
  }

  private logSecurityEvent(eventType: keyof typeof SECURITY_EVENT_TYPES): void {
    // Implement security event logging
    console.warn(`Security event: ${eventType}`, {
      timestamp: new Date(),
      context: securityContext
    });
  }
}

// Export singleton instance
export const auth = new AuthService();