'use client';

import React, { useEffect } from 'react';
import { notFound } from 'next/navigation';
import * as Sentry from '@sentry/nextjs'; // ^7.0.0
import DocumentPreview from '../../../../components/documents/DocumentPreview';
import DocumentVerification from '../../../../components/documents/DocumentVerification';
import { useDocument } from '../../../../hooks/useDocument';
import { Document } from '../../../../types/document.types';

// Constants for polling and error handling
const POLLING_INTERVAL = 5000;
const ERROR_MESSAGES = {
  NOT_FOUND: 'Document not found',
  LOAD_ERROR: 'Error loading document',
  VERIFICATION_ERROR: 'Verification process failed'
} as const;

// Interface for page props with document ID
interface PageProps {
  params: {
    id: string;
  };
}

/**
 * Server component for displaying document details with real-time verification status
 * Implements secure document preview and verification tracking
 */
export default function DocumentPage({ params }: PageProps): JSX.Element {
  // Initialize document state using custom hook
  const {
    document,
    error,
    isUploading,
    uploadProgress,
    securityContext
  } = useDocument(params.id, {
    pollInterval: POLLING_INTERVAL,
    autoVerify: true,
    securityLevel: 'high'
  });

  // Handle document not found
  useEffect(() => {
    if (error?.code === 'NOT_FOUND') {
      notFound();
    }
  }, [error]);

  // Track document view event
  useEffect(() => {
    if (document) {
      try {
        // Analytics tracking
        window.gtag?.('event', 'view_document', {
          document_id: document.id,
          document_type: document.type,
          document_status: document.status
        });
      } catch (error) {
        Sentry.captureException(error, {
          level: 'warning',
          tags: { component: 'DocumentPage' }
        });
      }
    }
  }, [document]);

  // Handle verification completion
  const handleVerificationComplete = (result: Document['verificationResult']) => {
    try {
      // Trigger any necessary UI updates or notifications
      window.gtag?.('event', 'document_verified', {
        document_id: document?.id,
        confidence_score: result.confidenceScore,
        verification_method: result.verificationMethod
      });
    } catch (error) {
      Sentry.captureException(error, {
        level: 'error',
        tags: { component: 'DocumentPage', action: 'verificationComplete' }
      });
    }
  };

  // Handle verification errors
  const handleVerificationError = (error: Error) => {
    Sentry.captureException(error, {
      level: 'error',
      tags: { component: 'DocumentPage', action: 'verification' }
    });
  };

  // Handle manual review requests
  const handleManualReviewRequested = () => {
    try {
      window.gtag?.('event', 'request_manual_review', {
        document_id: document?.id,
        document_type: document?.type
      });
    } catch (error) {
      Sentry.captureException(error, {
        level: 'warning',
        tags: { component: 'DocumentPage', action: 'manualReview' }
      });
    }
  };

  // Show loading state
  if (!document && !error) {
    return (
      <div className="container mx-auto p-4 space-y-6" role="status" aria-busy="true">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="aspect-video bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  // Show error state
  if (error && error.code !== 'NOT_FOUND') {
    return (
      <div 
        className="container mx-auto p-4 text-red-600 bg-red-50 rounded-lg"
        role="alert"
        aria-live="polite"
      >
        <h1 className="text-lg font-semibold mb-2">Error Loading Document</h1>
        <p>{error.message || ERROR_MESSAGES.LOAD_ERROR}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Document Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">
          Document Details
        </h1>
        {securityContext && (
          <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            Secure Connection
          </div>
        )}
      </header>

      {/* Document Preview Section */}
      <section aria-label="Document Preview">
        <DocumentPreview
          document={document!}
          className="w-full"
          isLoading={isUploading}
          showConfidenceScore={true}
          onError={(error) => {
            Sentry.captureException(error, {
              level: 'error',
              tags: { component: 'DocumentPreview' }
            });
          }}
          accessibilityLabel={`Preview of ${document?.fileName}`}
        />
      </section>

      {/* Verification Status Section */}
      <section aria-label="Document Verification Status">
        <DocumentVerification
          documentId={params.id}
          className="w-full"
          onVerificationComplete={handleVerificationComplete}
          onVerificationError={handleVerificationError}
          onManualReviewRequested={handleManualReviewRequested}
          showConfidenceScore={true}
          autoRetry={true}
        />
      </section>

      {/* Upload Progress Indicator */}
      {isUploading && (
        <div 
          className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center space-x-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-sm font-medium">{uploadProgress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Generate metadata for the document page
 */
export async function generateMetadata({ params }: PageProps) {
  try {
    return {
      title: `Document Details - Precheck.me`,
      description: 'Secure document verification and preview interface',
      openGraph: {
        title: 'Document Verification - Precheck.me',
        description: 'Secure document verification system with real-time status tracking',
        type: 'website'
      }
    };
  } catch (error) {
    Sentry.captureException(error, {
      level: 'error',
      tags: { component: 'DocumentPage', action: 'generateMetadata' }
    });
    return {
      title: 'Document Details - Precheck.me'
    };
  }
}