// @package react ^18.0.0
// @package next/navigation ^14.0.0

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  MFAChallenge,
  OrganizationContext,
  AuthError
} from '../types/auth.types';
import AuthService from '../services/auth.service';

/**
 * Enhanced authentication hook with MFA and multi-tenant support
 * @returns Authentication state and methods
 */
export const useAuth = () => {
  // Initialize auth state with organization context
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    mfaRequired: false,
    organization: null
  });

  // Initialize memoized auth service instance
  const authService = useMemo(() => AuthService, []);
  const router = useRouter();

  /**
   * Validate and refresh authentication session
   */
  const validateSession = useCallback(async () => {
    try {
      const currentState = authService.getCurrentAuthState();
      if (currentState.accessToken) {
        const isValid = await authService.validateToken(currentState.accessToken);
        if (!isValid) {
          await authService.refreshToken();
        }
        setAuthState({
          ...currentState,
          isAuthenticated: true,
          mfaRequired: false
        });
      }
    } catch (error) {
      await handleLogout();
    }
  }, [authService]);

  /**
   * Handle secure login with MFA support
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      const response = await authService.login(credentials);
      
      if (response.mfaRequired) {
        setAuthState({
          ...authState,
          mfaRequired: true,
          tempToken: response.accessToken
        });
        router.push('/auth/mfa');
        return;
      }

      setAuthState({
        isAuthenticated: true,
        user: response.user,
        accessToken: response.accessToken,
        mfaRequired: false,
        organization: {
          id: response.user.organization_id,
          role: response.user.role
        }
      });

      router.push('/dashboard');
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'Authentication failed');
    }
  }, [authService, authState, router]);

  /**
   * Handle MFA validation
   */
  const validateMFA = useCallback(async (mfaToken: MFAChallenge): Promise<void> => {
    try {
      if (!authState.tempToken) {
        throw new Error('Invalid authentication state');
      }

      const response = await authService.validateMFA(mfaToken, authState.tempToken);
      
      setAuthState({
        isAuthenticated: true,
        user: response.user,
        accessToken: response.accessToken,
        mfaRequired: false,
        organization: {
          id: response.user.organization_id,
          role: response.user.role
        }
      });

      router.push('/dashboard');
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'MFA validation failed');
    }
  }, [authService, authState, router]);

  /**
   * Handle user registration with organization context
   */
  const register = useCallback(async (credentials: RegisterCredentials): Promise<void> => {
    try {
      const response = await authService.register(credentials);
      
      setAuthState({
        isAuthenticated: true,
        user: response.user,
        accessToken: response.accessToken,
        mfaRequired: false,
        organization: {
          id: response.user.organization_id,
          role: response.user.role
        }
      });

      router.push('/dashboard');
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'Registration failed');
    }
  }, [authService, router]);

  /**
   * Handle secure logout and cleanup
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      setAuthState({
        isAuthenticated: false,
        user: null,
        accessToken: null,
        mfaRequired: false,
        organization: null
      });
      router.push('/auth/login');
    }
  }, [authService, router]);

  /**
   * Switch organization context
   */
  const switchOrganization = useCallback(async (organizationId: string): Promise<void> => {
    try {
      const response = await authService.switchOrganization(organizationId);
      
      setAuthState({
        ...authState,
        user: response.user,
        accessToken: response.accessToken,
        organization: {
          id: response.user.organization_id,
          role: response.user.role
        }
      });
    } catch (error) {
      const authError = error as AuthError;
      throw new Error(authError.message || 'Organization switch failed');
    }
  }, [authService, authState]);

  // Validate session on mount and setup refresh mechanism
  useEffect(() => {
    validateSession();

    // Setup periodic session validation
    const intervalId = setInterval(validateSession, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(intervalId);
    };
  }, [validateSession]);

  return {
    ...authState,
    login,
    register,
    logout: handleLogout,
    validateMFA,
    switchOrganization
  };
};

export default useAuth;