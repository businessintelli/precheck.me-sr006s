import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoginForm } from '../../../components/auth/LoginForm';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// Mock useAuth hook
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn(),
    isLoading: false,
  })),
}));

// Test data constants
const validCredentials = {
  email: 'test@example.com',
  password: 'Password123!',
};

const invalidCredentials = {
  email: 'invalid-email',
  password: 'short',
};

describe('LoginForm', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockLogin: ReturnType<typeof vi.fn>;
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user = userEvent.setup();
    mockLogin = vi.fn();
    mockPush = vi.fn();

    // Reset mocks
    (useAuth as jest.Mock).mockImplementation(() => ({
      login: mockLogin,
      isLoading: false,
    }));
    (useRouter as jest.Mock).mockImplementation(() => ({
      push: mockPush,
    }));

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all form elements correctly', () => {
      render(<LoginForm />);

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render password toggle button', () => {
      render(<LoginForm />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('should apply correct Material Design styles', () => {
      render(<LoginForm />);

      const form = screen.getByRole('form');
      expect(form).toHaveClass('space-y-4');
      
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveClass('w-full');
    });
  });

  describe('Form Validation', () => {
    it('should show required field errors when submitting empty form', async () => {
      render(<LoginForm />);
      
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      render(<LoginForm />);

      await user.type(screen.getByLabelText(/email/i), 'invalid-email');
      await user.tab();

      expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
    });

    it('should validate password requirements', async () => {
      render(<LoginForm />);

      await user.type(screen.getByLabelText(/password/i), 'weak');
      await user.tab();

      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      render(<LoginForm redirectPath="/dashboard" />);

      await user.type(screen.getByLabelText(/email/i), validCredentials.email);
      await user.type(screen.getByLabelText(/password/i), validCredentials.password);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: validCredentials.email,
          password: validCredentials.password,
        });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should handle login failure', async () => {
      const errorMessage = 'Invalid credentials';
      mockLogin.mockRejectedValueOnce(new Error(errorMessage));

      render(<LoginForm />);

      await user.type(screen.getByLabelText(/email/i), validCredentials.email);
      await user.type(screen.getByLabelText(/password/i), validCredentials.password);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText(errorMessage)).toBeInTheDocument();
    });

    it('should handle rate limiting', async () => {
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      render(<LoginForm />);

      // Attempt login multiple times
      for (let i = 0; i < 5; i++) {
        await user.type(screen.getByLabelText(/email/i), validCredentials.email);
        await user.type(screen.getByLabelText(/password/i), validCredentials.password);
        await user.click(screen.getByRole('button', { name: /sign in/i }));
      }

      expect(await screen.findByText(/too many login attempts/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should maintain focus after toggling password visibility', async () => {
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      await user.type(passwordInput, 'test');
      await user.click(toggleButton);

      expect(passwordInput).toHaveFocus();
    });
  });

  describe('Loading State', () => {
    it('should disable form during submission', async () => {
      (useAuth as jest.Mock).mockImplementation(() => ({
        login: vi.fn(() => new Promise(resolve => setTimeout(resolve, 100))),
        isLoading: true,
      }));

      render(<LoginForm />);

      await user.type(screen.getByLabelText(/email/i), validCredentials.email);
      await user.type(screen.getByLabelText(/password/i), validCredentials.password);
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<LoginForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      render(<LoginForm />);

      await user.tab();
      expect(screen.getByLabelText(/email/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/password/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /show password/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      render(<LoginForm />);

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/email is required/i);
    });
  });
});