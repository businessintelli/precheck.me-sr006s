"use client";

import React, { useEffect } from 'react';
import { Metadata } from 'next';
import { useWebSocket } from 'react-use-websocket'; // @version ^4.5.0
import { ErrorBoundary } from 'react-error-boundary'; // @version ^4.0.11

import DashboardShell from '../../../../components/layout/DashboardShell';
import CheckDetails from '../../../../components/background-checks/CheckDetails';
import { BackgroundCheckStatus } from '../../../../types/background-check.types';
import { NotificationType } from '../../../../types/notification.types';
import { WEBSOCKET_CONFIG } from '../../../../config/websocket.config';

// Dynamic metadata generation for SEO
export const generateMetadata = async ({ params }: { params: { id: string } }): Promise<Metadata> => {
  return {
    title: `Background Check #${params.id} | Precheck.me`,
    description: 'View detailed information and real-time status updates of background verification process',
    openGraph: {
      title: `Background Check Details - ${params.id}`,
      description: 'Real-time background check verification details and status',
      type: 'website',
      siteName: 'Precheck.me'
    },
    robots: {
      index: false,
      follow: true
    }
  };
};

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) => {
  return (
    <DashboardShell>
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-4">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">
          Error Loading Background Check
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {error.message || 'An unexpected error occurred while loading the background check details.'}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Retry loading background check details"
        >
          Try Again
        </button>
      </div>
    </DashboardShell>
  );
};

// Loading component
const LoadingState = () => {
  return (
    <DashboardShell>
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
        </div>
      </div>
    </DashboardShell>
  );
};

// Main page component
const BackgroundCheckPage = ({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) => {
  // WebSocket setup for real-time updates
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    WEBSOCKET_CONFIG.url,
    {
      shouldReconnect: () => true,
      reconnectInterval: WEBSOCKET_CONFIG.options.reconnectInterval,
      reconnectAttempts: WEBSOCKET_CONFIG.options.maxRetries
    }
  );

  // Subscribe to status updates on mount
  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      sendMessage(JSON.stringify({
        type: NotificationType.CHECK_STATUS_UPDATE,
        checkId: params.id
      }));
    }
  }, [readyState, sendMessage, params.id]);

  // Handle status updates
  const handleStatusChange = (status: BackgroundCheckStatus) => {
    // Update page title based on new status
    document.title = `Background Check #${params.id} (${status}) | Precheck.me`;
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset error boundary state and retry data fetch
        window.location.reload();
      }}
    >
      <React.Suspense fallback={<LoadingState />}>
        <DashboardShell>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Background Check Details
              </h1>
            </div>
            
            <CheckDetails
              backgroundCheckId={params.id}
              onStatusChange={handleStatusChange}
              className="mt-6"
            />
          </div>
        </DashboardShell>
      </React.Suspense>
    </ErrorBoundary>
  );
};

export default BackgroundCheckPage;