// @package @testing-library/react ^14.0.0
// @package @jest/globals ^29.0.0
// @package next/navigation ^14.0.0

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { useRouter } from 'next/navigation';

import useAuth from '../../hooks/useAuth';
import AuthService from '../../services/auth.service';
import { UserRole, UserStatus } from '../../types/user.types';
import { AuthError } from '../../types/auth.types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock AuthService
jest.mock('../../services/auth.service', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    validateMFA: jest.fn(),
    refreshToken: jest.fn(),
    switchOrganization: jest.fn(),
    getCurrentAuthState: jest.fn(),
    validateToken: jest.fn(),
  },
}));

describe('useAuth Hook', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    role: UserRole.HR_MANAGER,
    status: UserStatus.ACTIVE,
    organization_id: 'org123',
    profile: {
      first_name: 'Test',
      last_name: 'User',
      phone: '+1234567890',
      avatar_url: null,
      timezone: 'UTC',
      locale: 'en-US',
    },
    last_login: new Date(),
    mfa_enabled: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (AuthService.getCurrentAuthState as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      mfaRequired: false,
      organization: null,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should initialize with unauthenticated state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.organization).toBeNull();
  });

  it('should handle successful login with MFA', async () => {
    const mockLoginResponse = {
      mfaRequired: true,
      accessToken: 'temp-token',
    };

    (AuthService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
    });

    expect(result.current.mfaRequired).toBe(true);
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/mfa');
  });

  it('should handle successful login without MFA', async () => {
    const mockLoginResponse = {
      user: mockUser,
      accessToken: 'valid-token',
      mfaRequired: false,
    };

    (AuthService.login as jest.Mock).mockResolvedValueOnce(mockLoginResponse);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  it('should handle MFA verification', async () => {
    const mockMFAResponse = {
      user: mockUser,
      accessToken: 'valid-token',
    };

    (AuthService.validateMFA as jest.Mock).mockResolvedValueOnce(mockMFAResponse);

    const { result } = renderHook(() => useAuth());

    // Set initial state with tempToken
    act(() => {
      result.current.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
    });

    await act(async () => {
      await result.current.validateMFA({ token: '123456' });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.mfaRequired).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });

  it('should handle organization switching', async () => {
    const newOrgId = 'org456';
    const mockSwitchResponse = {
      user: { ...mockUser, organization_id: newOrgId },
      accessToken: 'new-token',
    };

    (AuthService.switchOrganization as jest.Mock).mockResolvedValueOnce(mockSwitchResponse);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.switchOrganization(newOrgId);
    });

    expect(result.current.organization?.id).toBe(newOrgId);
    expect(result.current.user?.organization_id).toBe(newOrgId);
  });

  it('should handle logout', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.organization).toBeNull();
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/login');
    expect(AuthService.logout).toHaveBeenCalled();
  });

  it('should handle session validation and refresh', async () => {
    (AuthService.validateToken as jest.Mock).mockResolvedValueOnce(false);
    (AuthService.refreshToken as jest.Mock).mockResolvedValueOnce({
      user: mockUser,
      accessToken: 'refreshed-token',
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(AuthService.validateToken).toHaveBeenCalled();
      expect(AuthService.refreshToken).toHaveBeenCalled();
    });
  });

  it('should handle login errors', async () => {
    const mockError = new Error('Invalid credentials') as AuthError;
    (AuthService.login as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'wrong-password',
        });
      })
    ).rejects.toThrow('Invalid credentials');

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle organization switch errors', async () => {
    const mockError = new Error('Organization switch failed') as AuthError;
    (AuthService.switchOrganization as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.switchOrganization('invalid-org');
      })
    ).rejects.toThrow('Organization switch failed');
  });

  it('should handle invalid MFA tokens', async () => {
    const mockError = new Error('Invalid MFA token') as AuthError;
    (AuthService.validateMFA as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.validateMFA({ token: 'invalid-token' });
      })
    ).rejects.toThrow('Invalid MFA token');

    expect(result.current.mfaRequired).toBe(false);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useAuth());
    
    unmount();
    
    // Verify cleanup of intervals/timeouts
    expect(jest.getTimerCount()).toBe(0);
  });
});