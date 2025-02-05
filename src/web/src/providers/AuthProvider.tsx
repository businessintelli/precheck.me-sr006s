// @package react ^18.0.0
// @package next ^14.0.0
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';

import AuthService from '../services/auth.service';
import { AuthState, LoginCredentials, RegisterCredentials } from '../types/auth.types';
import { UserRole } from '../types/user.types';

// Security constants
const SESSION_CHECK_INTERVAL = 60000; // 1 minute
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials, enableMFA?: boolean) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  validateSession: () => Promise<boolean>;
  rotateToken: () => Promise<void>;
  checkPermission: (permission: string) => boolean;
  isLoading: boolean;
}

const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  accessToken: null,
  organizationId: null,
  sessionId: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const router = useRouter();

  // Initialize auth state from stored session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentState = AuthService.getCurrentAuthState();
        if (currentState.isAuthenticated && currentState.accessToken) {
          const isValid = await AuthService.validateToken(currentState.accessToken);
          if (!isValid) {
            await handleLogout();
          } else {
            setState(currentState);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await handleLogout();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up activity monitoring
  useEffect(() => {
    const updateActivity = () => setLastActivity(Date.now());
    const events = ['mousedown', 'keydown', 'touchstart', 'mousemove'];

    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, []);

  // Check for session timeout
  useEffect(() => {
    const checkSession = async () => {
      if (state.isAuthenticated) {
        const currentTime = Date.now();
        if (currentTime - lastActivity > IDLE_TIMEOUT) {
          await handleLogout();
          router.push('/login?reason=session_timeout');
        }
      }
    };

    const interval = setInterval(checkSession, SESSION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [state.isAuthenticated, lastActivity]);

  // Route protection
  useEffect(() => {
    const handleRouteChange = async (url: string) => {
      if (!isLoading && !PUBLIC_ROUTES.includes(url)) {
        if (!state.isAuthenticated) {
          router.push(`/login?redirect=${encodeURIComponent(url)}`);
        } else {
          const isValid = await validateSession();
          if (!isValid) {
            await handleLogout();
            router.push('/login?reason=invalid_session');
          }
        }
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [state.isAuthenticated, isLoading]);

  const handleLogin = async (credentials: LoginCredentials, enableMFA: boolean = false) => {
    try {
      setIsLoading(true);
      const authState = await AuthService.login(credentials, enableMFA);
      setState(authState);
      setLastActivity(Date.now());
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (credentials: RegisterCredentials) => {
    try {
      setIsLoading(true);
      // Registration logic would be implemented in AuthService
      throw new Error('Registration not implemented');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await AuthService.logout();
      setState(initialAuthState);
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    try {
      await AuthService.refreshToken();
      const newState = AuthService.getCurrentAuthState();
      setState(newState);
    } catch (error) {
      await handleLogout();
      throw error;
    }
  };

  const validateSession = async (): Promise<boolean> => {
    if (!state.accessToken) return false;
    try {
      return await AuthService.validateToken(state.accessToken);
    } catch {
      return false;
    }
  };

  const rotateToken = useCallback(async () => {
    try {
      await handleRefreshToken();
    } catch (error) {
      console.error('Token rotation error:', error);
      await handleLogout();
    }
  }, []);

  const checkPermission = useCallback((permission: string): boolean => {
    if (!state.user?.role) return false;
    
    // Role hierarchy check
    const roleHierarchy = {
      [UserRole.SYSTEM_ADMIN]: 4,
      [UserRole.COMPANY_ADMIN]: 3,
      [UserRole.HR_MANAGER]: 2,
      [UserRole.CANDIDATE]: 1,
    };

    const userRoleLevel = roleHierarchy[state.user.role];
    const requiredRoleLevel = roleHierarchy[permission as UserRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }, [state.user?.role]);

  const contextValue: AuthContextType = {
    state,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshToken: handleRefreshToken,
    validateSession,
    rotateToken,
    checkPermission,
    isLoading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;