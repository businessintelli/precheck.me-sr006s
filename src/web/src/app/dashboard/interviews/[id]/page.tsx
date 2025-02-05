"use client";

import React from 'react';
import { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { inject } from '@vercel/analytics';
import { ErrorBoundary } from 'react-error-boundary';

import DashboardShell from '@/components/layout/DashboardShell';
import InterviewDetails from '@/components/interviews/InterviewDetails';

// Initialize analytics
inject();

// Interface for page props
interface InterviewPageProps {
  params: {
    id: string;
  };
  searchParams: {
    lang?: string;
    theme?: string;
  };
}

// Metadata generation for SEO and social sharing
export const generateMetadata = async ({ params }: { params: { id: string } }): Promise<Metadata> => {
  return {
    title: `Interview Details | Precheck.me`,
    description: 'View detailed information about the AI-powered interview session including questions, responses, and analysis with real-time updates',
    openGraph: {
      title: 'Interview Analysis | Precheck.me',
      description: 'Comprehensive AI-powered interview analysis and insights',
      type: 'website',
      images: [
        {
          url: '/og-interview.png',
          width: 1200,
          height: 630,
          alt: 'Interview Analysis'
        }
      ]
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    },
    alternates: {
      canonical: `/interviews/${params.id}`,
      languages: {
        'en-US': `/en-US/interviews/${params.id}`,
        'en-UK': `/en-UK/interviews/${params.id}`,
        'hi-IN': `/hi-IN/interviews/${params.id}`
      }
    }
  };
};

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
  const t = useTranslations('interviews');

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center" role="alert">
      <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
        {t('error.title')}
      </h2>
      <p className="text-gray-600 dark:text-gray-300 mb-4">
        {t('error.message')}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
      >
        {t('error.retry')}
      </button>
    </div>
  );
};

// Loading component
const LoadingState = () => (
  <div className="animate-pulse space-y-4 p-6">
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
    </div>
  </div>
);

// Main interview details page component
const InterviewPage: React.FC<InterviewPageProps> = ({ params, searchParams }) => {
  const t = useTranslations('interviews');

  // Handle error logging
  const handleError = (error: Error) => {
    console.error('Interview page error:', error);
    // Log to analytics or error tracking service
  };

  return (
    <DashboardShell>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={handleError}
        onReset={() => window.location.reload()}
      >
        <React.Suspense fallback={<LoadingState />}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                {t('details.title')}
              </h1>
            </div>

            <InterviewDetails
              interviewId={params.id}
              className="rounded-lg border shadow-sm"
            />
          </div>
        </React.Suspense>
      </ErrorBoundary>
    </DashboardShell>
  );
};

export default InterviewPage;