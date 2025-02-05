'use client';

import React, { useEffect } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import LoginForm from '../../../components/auth/LoginForm';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';

/**
 * Enhanced metadata configuration with security headers
 */
export const generateMetadata = (): Metadata => {
  return {
    title: 'Login | Precheck.me',
    description: 'Secure multi-tenant login portal for Precheck.me background verification platform',
    robots: 'noindex, nofollow',
    // Enhanced security headers
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: process.env.NEXT_PUBLIC_APP_URL,
      title: 'Login | Precheck.me',
      description: 'Secure login portal for Precheck.me',
      siteName: 'Precheck.me'
    },
    other: {
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  };
};

/**
 * Enhanced login page component with multi-tenant support and Material Design 3.0
 * Implements WCAG 2.1 Level AA compliance for accessibility
 */
const LoginPage: React.FC = () => {
  const { isAuthenticated, organizationContext } = useAuth();

  // Redirect authenticated users to their organization-specific dashboard
  useEffect(() => {
    if (isAuthenticated && organizationContext?.id) {
      redirect(`/dashboard/${organizationContext.id}`);
    }
  }, [isAuthenticated, organizationContext]);

  return (
    <div
      className={cn(
        // Material Design 3.0 layout with responsive design
        'min-h-screen w-full flex flex-col items-center justify-center',
        'bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800',
        'p-4 sm:p-6 md:p-8'
      )}
    >
      <div
        className={cn(
          // Material Design elevation and responsive container
          'w-full max-w-md',
          'bg-white dark:bg-gray-800',
          'rounded-lg shadow-lg',
          'transition-all duration-300 ease-in-out',
          // Enhanced focus outline for accessibility
          'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2'
        )}
        // Enhanced accessibility attributes
        role="main"
        aria-labelledby="login-heading"
      >
        <div className="px-6 py-8 md:px-8">
          <div className="text-center mb-8">
            {/* Accessible heading with proper hierarchy */}
            <h1
              id="login-heading"
              className={cn(
                'text-2xl font-bold tracking-tight',
                'text-gray-900 dark:text-gray-100',
                'mb-2'
              )}
            >
              Welcome to Precheck.me
            </h1>
            <p
              className={cn(
                'text-sm text-gray-600 dark:text-gray-400',
                'max-w-sm mx-auto'
              )}
            >
              Sign in to access your secure verification portal
            </p>
          </div>

          {/* Enhanced LoginForm with accessibility and validation */}
          <LoginForm
            className="w-full"
            // Redirect to organization-specific dashboard on success
            redirectPath={
              organizationContext?.id
                ? `/dashboard/${organizationContext.id}`
                : '/dashboard'
            }
          />

          {/* Additional help text with accessibility support */}
          <div
            className={cn(
              'mt-6 text-center text-sm',
              'text-gray-600 dark:text-gray-400'
            )}
          >
            <p>
              Need assistance?{' '}
              <a
                href="/support"
                className={cn(
                  'text-primary-600 hover:text-primary-700',
                  'dark:text-primary-400 dark:hover:text-primary-300',
                  'font-medium transition-colors',
                  // Enhanced focus styles for accessibility
                  'focus:outline-none focus:ring-2 focus:ring-primary-500',
                  'focus:ring-offset-2 rounded'
                )}
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only',
          'absolute top-0 left-0 p-4',
          'bg-primary-500 text-white',
          'focus:outline-none focus:ring-2',
          'focus:ring-primary-500 focus:ring-offset-2'
        )}
      >
        Skip to main content
      </a>
    </div>
  );
};

export default LoginPage;