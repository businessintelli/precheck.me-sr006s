'use client';

// @package next ^14.0.0
// @package react-error-boundary ^4.0.0

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { cn } from '@/lib/utils';

/**
 * Metadata configuration for the forgot password page
 * Implements SEO best practices and security headers
 */
export const metadata = {
  title: 'Forgot Password | Precheck.me - Secure Background Check Platform',
  description: 'Reset your password securely on Precheck.me - The comprehensive background check and AI-powered interview platform. Industry-leading security measures ensure your data protection.',
  robots: 'noindex, nofollow',
  openGraph: {
    title: 'Reset Your Password | Precheck.me',
    description: 'Securely reset your password on Precheck.me platform',
    type: 'website',
  },
  headers: {
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
  },
};

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className={cn(
    'rounded-md bg-red-50 dark:bg-red-900/50 p-4 mt-4',
    'transition-colors duration-200'
  )}>
    <div className="flex">
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
          An error occurred
        </h3>
        <div className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error.message}
        </div>
      </div>
    </div>
  </div>
);

/**
 * ForgotPasswordPage component implementing Material Design 3.0 principles
 * and WCAG 2.1 Level AA compliance
 */
const ForgotPasswordPage: React.FC = () => {
  return (
    <main 
      className={cn(
        'min-h-screen flex flex-col items-center justify-center',
        'py-12 px-4 sm:px-6 lg:px-8',
        'bg-gray-50 dark:bg-gray-900',
        'transition-colors duration-200'
      )}
      // Enhanced accessibility attributes
      role="main"
      aria-labelledby="forgot-password-title"
    >
      <div className={cn(
        'max-w-md w-full space-y-8',
        'relative'
      )}>
        <div className={cn(
          'text-center space-y-4'
        )}>
          <h1 
            id="forgot-password-title"
            className={cn(
              'mt-6 text-3xl font-extrabold',
              'text-gray-900 dark:text-gray-100',
              'transition-colors duration-200'
            )}
          >
            Reset Your Password
          </h1>
          <p className={cn(
            'mt-2 text-sm',
            'text-gray-600 dark:text-gray-400',
            'transition-colors duration-200'
          )}>
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </p>
        </div>

        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={(error) => {
            // Log error to monitoring service in production
            console.error('Forgot password error:', error);
          }}
        >
          <ForgotPasswordForm />
        </ErrorBoundary>

        {/* Skip link for keyboard navigation */}
        <a
          href="#main-content"
          className={cn(
            'sr-only focus:not-sr-only',
            'absolute left-0 p-2',
            'bg-primary text-primary-foreground',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
          )}
        >
          Skip to main content
        </a>
      </div>
    </main>
  );
};

export default ForgotPasswordPage;