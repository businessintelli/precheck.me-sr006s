"use client";

// React and core dependencies - v18.0.0
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // v14.0.0
import { z } from 'zod'; // v3.22.0
import { hash } from 'bcryptjs'; // v2.4.3

// Internal imports
import { Form } from '../shared/Form';
import { Button } from '../shared/Button';
import { useAuth } from '../../hooks/useAuth';

// Password validation constants
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 72;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

// Rate limiting constants
const RATE_LIMIT_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 300000; // 5 minutes in milliseconds

// Enhanced password validation schema with security checks
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(MAX_PASSWORD_LENGTH, 'Password exceeds maximum length')
    .regex(
      PASSWORD_REGEX,
      'Password must contain uppercase, lowercase, numbers, and special characters'
    ),
  confirmPassword: z.string()
}).refine(
  (data) => data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ["confirmPassword"]
  }
);

// Component props interface
interface ResetPasswordFormProps {
  token: string;
}

// Form data interface
interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

/**
 * ResetPasswordForm Component
 * 
 * A secure and accessible form for resetting user passwords with
 * enhanced validation, rate limiting, and security measures.
 */
const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token }) => {
  const router = useRouter();
  const { resetPassword, validateToken } = useAuth();
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Validate token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const isValid = await validateToken(token);
        setIsTokenValid(isValid);
        if (!isValid) {
          router.push('/auth/login?error=invalid-token');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        router.push('/auth/login?error=token-error');
      }
    };

    verifyToken();
  }, [token, validateToken, router]);

  // Check rate limiting
  const checkRateLimit = (): boolean => {
    const now = Date.now();
    if (attempts >= RATE_LIMIT_ATTEMPTS) {
      const timeElapsed = now - lastAttemptTime;
      if (timeElapsed < RATE_LIMIT_WINDOW) {
        return false;
      }
      // Reset attempts after window expires
      setAttempts(0);
    }
    return true;
  };

  // Handle form submission with security measures
  const handleSubmit = async (data: ResetPasswordFormData) => {
    try {
      if (!checkRateLimit()) {
        throw new Error(`Too many attempts. Please try again in ${Math.ceil((RATE_LIMIT_WINDOW - (Date.now() - lastAttemptTime)) / 1000)} seconds`);
      }

      setIsLoading(true);
      setAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());

      // Hash password client-side for additional security
      const hashedPassword = await hash(data.password, 10);

      await resetPassword({
        token,
        password: hashedPassword,
      });

      // Redirect to login on success
      router.push('/auth/login?status=password-reset-success');
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  if (!isTokenValid) {
    return null;
  }

  return (
    <div className="w-full max-w-md space-y-6 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Reset Your Password
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Please enter your new password below
        </p>
      </div>

      <Form
        schema={resetPasswordSchema}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {({ register, formState: { errors } }) => (
          <>
            <div className="space-y-4">
              <div className="relative">
                <input
                  {...register('password')}
                  type="password"
                  id="password"
                  autoComplete="new-password"
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  aria-describedby="password-requirements"
                />
                {errors.password && (
                  <span 
                    role="alert" 
                    className="text-sm font-medium text-red-500 mt-1 animate-shake"
                  >
                    {errors.password.message}
                  </span>
                )}
                <div 
                  id="password-requirements" 
                  className="mt-2 text-xs text-gray-500 dark:text-gray-400"
                >
                  Password must be at least 12 characters and include uppercase, lowercase, 
                  numbers, and special characters
                </div>
              </div>

              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type="password"
                  id="confirmPassword"
                  autoComplete="new-password"
                  className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {errors.confirmPassword && (
                  <span 
                    role="alert" 
                    className="text-sm font-medium text-red-500 mt-1 animate-shake"
                  >
                    {errors.confirmPassword.message}
                  </span>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Reset Password
            </Button>
          </>
        )}
      </Form>
    </div>
  );
};

export default ResetPasswordForm;