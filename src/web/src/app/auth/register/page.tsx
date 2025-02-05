'use client';

// @package react ^18.0.0
// @package next 14.0.0
// @package @clerk/nextjs ^4.0.0
// @package react-error-boundary ^4.0.0

import React from 'react';
import { Metadata } from 'next';
import { useOrganization } from '@clerk/nextjs';
import { ErrorBoundary } from 'react-error-boundary';
import RegisterForm from '../../../components/auth/RegisterForm';

// SEO and metadata configuration
export const generateMetadata = (): Metadata => {
  return {
    title: 'Register | Precheck.me',
    description: 'Create your account on Precheck.me - The comprehensive background check and AI-powered interview platform',
    keywords: 'register, signup, background check, AI interview, verification',
    openGraph: {
      title: 'Join Precheck.me - Streamline Your Hiring Process',
      description: 'Sign up for Precheck.me to access AI-powered interviews and comprehensive background checks',
      type: 'website',
      url: 'https://precheck.me/auth/register',
      siteName: 'Precheck.me',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Join Precheck.me',
      description: 'Sign up for comprehensive background checks and AI interviews',
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: 'https://precheck.me/auth/register',
    },
  };
};

// Error fallback component with Material Design styling
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-4 rounded-md bg-destructive/10 text-destructive" role="alert">
    <h2 className="text-lg font-semibold mb-2">Registration Error</h2>
    <p className="mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      aria-label="Try again"
    >
      Try Again
    </button>
  </div>
);

// Main registration page component
const RegisterPage = () => {
  const { organization } = useOrganization();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        {/* Header section with semantic structure */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-muted-foreground text-base">
            Join Precheck.me to streamline your hiring process
          </p>
        </header>

        {/* Registration form with error boundary */}
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={() => window.location.reload()}
        >
          <div className="w-full max-w-md space-y-6">
            <RegisterForm
              organizationId={organization?.id || ''}
              onSuccess={() => {
                // Analytics tracking for successful registration
                if (typeof window !== 'undefined' && 'gtag' in window) {
                  (window as any).gtag('event', 'registration_complete', {
                    event_category: 'authentication',
                    event_label: 'user_registration',
                  });
                }
              }}
              onError={(error: Error) => {
                // Error tracking
                console.error('Registration error:', error);
                // Analytics tracking for registration errors
                if (typeof window !== 'undefined' && 'gtag' in window) {
                  (window as any).gtag('event', 'registration_error', {
                    event_category: 'authentication',
                    event_label: error.message,
                  });
                }
              }}
            />
          </div>
        </ErrorBoundary>

        {/* Accessibility skip link */}
        <div className="sr-only focus:not-sr-only">
          <a
            href="#main-content"
            className="absolute left-4 top-4 px-4 py-2 bg-primary text-primary-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Skip to main content
          </a>
        </div>
      </div>
    </main>
  );
};

export default RegisterPage;