// @package jwt-decode ^4.0.0
// @package axios-retry ^3.8.0
// @package crypto-js ^4.1.1
import { jwtDecode } from 'jwt-decode';
import axiosRetry from 'axios-retry';
import axios, { AxiosInstance, AxiosError } from 'axios';
import CryptoJS from 'crypto-js';

import { 
  AuthState, 
  LoginCredentials, 
  AuthResponse, 
  loginSchema 
} from '../types/auth.types';
import { 
  User, 
  UserRole, 
  UserStatus,
  validatePassword 
} from '../types/user.types';

// Security constants
const AUTH_STORAGE_KEY = 'auth_token_encrypted';
const REFRESH_TOKEN_KEY = 'refresh_token_encrypted';
const MAX_RETRY_ATTEMPTS = 3;
const TOKEN_REFRESH_THRESHOLD = 300; // 5 minutes in seconds
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key';

/**
 * Enhanced authentication service with multi-tenant support and security features
 */
export class AuthService {
  private httpClient: AxiosInstance;
  private refreshTokenTimeout?: NodeJS.Timeout;

  constructor() {
    this.httpClient = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Configure axios-retry with exponential backoff
    axiosRetry(this.httpClient, {
      retries: MAX_RETRY_ATTEMPTS,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429;
      }
    });

    // Request interceptor for authentication
    this.httpClient.interceptors.request.use(
      (config) => {
        const token = this.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for token refresh
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            await this.refreshToken();
            const token = this.getStoredToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.httpClient(originalRequest);
          } catch (refreshError) {
            await this.logout();
            throw refreshError;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate user with enhanced security and MFA support
   */
  public async login(credentials: LoginCredentials, enableMFA: boolean = false): Promise<AuthState> {
    try {
      // Validate credentials using Zod schema
      loginSchema.parse(credentials);
      
      // Additional password validation
      if (!validatePassword(credentials.password)) {
        throw new Error('Password does not meet security requirements');
      }

      const response = await this.httpClient.post<AuthResponse>('/auth/login', {
        ...credentials,
        enableMFA
      });

      if (!response.data || !response.data.accessToken) {
        throw new Error('Invalid authentication response');
      }

      const { user, accessToken, refreshToken } = response.data;

      // Encrypt tokens before storage
      this.storeTokens(accessToken, refreshToken);
      
      // Set up automatic token refresh
      this.setupTokenRefresh(accessToken);

      const authState: AuthState = {
        isAuthenticated: true,
        user,
        accessToken,
        organizationId: user.organization_id,
        roles: [user.role]
      };

      return authState;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Validate token integrity and expiration
   */
  public async validateToken(token: string): Promise<boolean> {
    try {
      if (!token) return false;

      const decoded = jwtDecode(token);
      if (!decoded || typeof decoded !== 'object') return false;

      // Check token expiration
      const exp = (decoded as { exp?: number }).exp;
      if (!exp || exp * 1000 < Date.now()) return false;

      // Verify token with backend
      const response = await this.httpClient.post('/auth/verify', { token });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Refresh authentication token
   */
  public async refreshToken(): Promise<void> {
    try {
      const refreshToken = this.getStoredRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.httpClient.post<AuthResponse>('/auth/refresh', {
        refreshToken
      });

      if (!response.data || !response.data.accessToken) {
        throw new Error('Invalid refresh token response');
      }

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      this.storeTokens(accessToken, newRefreshToken);
      this.setupTokenRefresh(accessToken);
    } catch (error) {
      await this.logout();
      throw error;
    }
  }

  /**
   * Securely log out user and clean up
   */
  public async logout(): Promise<void> {
    try {
      const refreshToken = this.getStoredRefreshToken();
      if (refreshToken) {
        await this.httpClient.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
      if (this.refreshTokenTimeout) {
        clearTimeout(this.refreshTokenTimeout);
      }
    }
  }

  /**
   * Check if user has required role
   */
  public hasRole(requiredRole: UserRole): boolean {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      const decoded = jwtDecode(token);
      if (!decoded || typeof decoded !== 'object') return false;

      const userRole = (decoded as { role?: UserRole }).role;
      return userRole === requiredRole;
    } catch {
      return false;
    }
  }

  /**
   * Get current authentication state
   */
  public getCurrentAuthState(): AuthState {
    const token = this.getStoredToken();
    if (!token) {
      return {
        isAuthenticated: false,
        user: null,
        accessToken: null,
        organizationId: null,
        roles: []
      };
    }

    try {
      const decoded = jwtDecode(token) as { user?: User };
      return {
        isAuthenticated: true,
        user: decoded.user || null,
        accessToken: token,
        organizationId: decoded.user?.organization_id || null,
        roles: decoded.user ? [decoded.user.role] : []
      };
    } catch {
      return {
        isAuthenticated: false,
        user: null,
        accessToken: null,
        organizationId: null,
        roles: []
      };
    }
  }

  // Private helper methods

  private storeTokens(accessToken: string, refreshToken: string): void {
    const encryptedAccess = CryptoJS.AES.encrypt(accessToken, ENCRYPTION_KEY).toString();
    const encryptedRefresh = CryptoJS.AES.encrypt(refreshToken, ENCRYPTION_KEY).toString();
    
    localStorage.setItem(AUTH_STORAGE_KEY, encryptedAccess);
    localStorage.setItem(REFRESH_TOKEN_KEY, encryptedRefresh);
  }

  private getStoredToken(): string | null {
    const encrypted = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!encrypted) return null;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }

  private getStoredRefreshToken(): string | null {
    const encrypted = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!encrypted) return null;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      return null;
    }
  }

  private clearTokens(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  private setupTokenRefresh(token: string): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    try {
      const decoded = jwtDecode(token);
      if (!decoded || typeof decoded !== 'object') return;

      const exp = (decoded as { exp?: number }).exp;
      if (!exp) return;

      const expiresIn = exp * 1000 - Date.now();
      const refreshTime = expiresIn - (TOKEN_REFRESH_THRESHOLD * 1000);

      if (refreshTime > 0) {
        this.refreshTokenTimeout = setTimeout(
          () => this.refreshToken(),
          refreshTime
        );
      }
    } catch (error) {
      console.error('Token refresh setup error:', error);
    }
  }
}

export default new AuthService();