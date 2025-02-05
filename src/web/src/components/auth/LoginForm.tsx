"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import clsx from 'clsx';

import { useAuth } from '../../hooks/useAuth';
import Form from '../shared/Form';
import { Button } from '../shared/Button';
import Input from '../shared/Input';
import { validateEmail } from '../../lib/utils';
import { VALIDATION_CONSTANTS } from '../../types/user.types';

// Enhanced login schema with strict validation rules
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must not exceed 255 characters')
    .refine(validateEmail, 'Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      VALIDATION_CONSTANTS.PASSWORD_REGEX,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    )
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  className?: string;
  onSuccess?: () => void;
  redirectPath?: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

export const LoginForm: React.FC<LoginFormProps> = ({
  className,
  onSuccess,
  redirectPath = '/dashboard'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  
  const passwordRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const router = useRouter();

  // Check for existing lockout on component mount
  useEffect(() => {
    const storedLockout = localStorage.getItem('login_lockout');
    if (storedLockout) {
      const lockoutTime = parseInt(storedLockout, 10);
      if (lockoutTime > Date.now()) {
        setLockoutUntil(lockoutTime);
      } else {
        localStorage.removeItem('login_lockout');
      }
    }
  }, []);

  // Handle rate limiting and lockout
  const handleRateLimit = useCallback(() => {
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);

    if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
      const lockoutTime = Date.now() + LOCKOUT_DURATION;
      setLockoutUntil(lockoutTime);
      localStorage.setItem('login_lockout', lockoutTime.toString());
      setError(`Too many login attempts. Please try again in 15 minutes.`);
      return true;
    }
    return false;
  }, [attemptCount]);

  // Handle form submission with enhanced security
  const handleSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      
      // Check for active lockout
      if (lockoutUntil && lockoutUntil > Date.now()) {
        const remainingMinutes = Math.ceil((lockoutUntil - Date.now()) / 60000);
        setError(`Please try again in ${remainingMinutes} minutes`);
        return;
      }

      // Check rate limiting
      if (handleRateLimit()) {
        return;
      }

      setIsLoading(true);

      await login({
        email: data.email.trim().toLowerCase(),
        password: data.password
      });

      // Reset attempt count on successful login
      setAttemptCount(0);
      localStorage.removeItem('login_lockout');

      if (onSuccess) {
        onSuccess();
      }
      
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle password visibility with focus retention
  const handlePasswordVisibility = () => {
    setShowPassword(!showPassword);
    // Maintain focus on password field after toggle
    if (passwordRef.current) {
      passwordRef.current.focus();
    }
  };

  return (
    <div
      className={clsx(
        'w-full max-w-md mx-auto p-6 space-y-6',
        'bg-white dark:bg-gray-800 rounded-lg shadow-md',
        className
      )}
    >
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Welcome Back
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Please sign in to continue
        </p>
      </div>

      <Form
        schema={loginSchema}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isLoading || !!lockoutUntil}
          aria-label="Email address"
          placeholder="Enter your email"
        />

        <div className="relative">
          <Input
            ref={passwordRef}
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={isLoading || !!lockoutUntil}
            aria-label="Password"
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={handlePasswordVisibility}
            className={clsx(
              'absolute right-3 top-[34px] text-gray-500',
              'hover:text-gray-700 focus:outline-none focus:text-gray-700'
            )}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={isLoading || !!lockoutUntil}
          >
            <span className="sr-only">
              {showPassword ? 'Hide password' : 'Show password'}
            </span>
            {/* Toggle icon based on showPassword state */}
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <div
            className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading || !!lockoutUntil}
          aria-disabled={isLoading || !!lockoutUntil}
        >
          Sign In
        </Button>
      </Form>
    </div>
  );
};

export default LoginForm;