'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAnalytics } from '@vercel/analytics'; // ^1.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import InterviewList from '../../../components/interviews/InterviewList';
import PageHeader from '../../../components/layout/PageHeader';
import { Button } from '../../../components/shared/Button';
import { useInterview } from '../../../hooks/useInterview';
import { WebSocketState } from '../../../hooks/useWebSocket';

/**
 * Enhanced interviews dashboard page component with real-time updates,
 * accessibility features, and comprehensive error handling.
 */
const InterviewsPage = () => {
  // Initialize hooks
  const router = useRouter();
  const { track } = useAnalytics();
  const {
    interview,
    loading,
    error,
    connectionStatus,
    retryConnection
  } = useInterview('', {
    autoConnect: true,
    enableRealtime: true,
    retryOnFailure: true
  });

  /**
   * Enhanced handler for scheduling new interviews with analytics tracking
   */
  const handleScheduleClick = React.useCallback(() => {
    track('interview_schedule_initiated', {
      source: 'dashboard',
      timestamp: new Date().toISOString()
    });
    router.push('/dashboard/interviews/schedule');
  }, [router, track]);

  /**
   * Handles WebSocket connection errors with retry logic
   */
  const handleConnectionError = React.useCallback(() => {
    track('interview_connection_error', {
      status: connectionStatus,
      timestamp: new Date().toISOString()
    });
    retryConnection();
  }, [connectionStatus, retryConnection, track]);

  /**
   * Renders connection status message with appropriate styling
   */
  const renderConnectionStatus = React.useCallback(() => {
    if (connectionStatus.isConnected) return null;

    return (
      <div
        role="alert"
        className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 mb-4"
      >
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="h-5 w-5 text-yellow-400" aria-hidden="true">⚠</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700 dark:text-yellow-200">
              Real-time updates are currently unavailable.
              <button
                onClick={handleConnectionError}
                className="ml-2 font-medium underline hover:text-yellow-600 dark:hover:text-yellow-100"
              >
                Try reconnecting
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }, [connectionStatus.isConnected, handleConnectionError]);

  /**
   * Error fallback component with retry functionality
   */
  const ErrorFallback = React.useCallback(({ error, resetErrorBoundary }) => (
    <div
      role="alert"
      className="rounded-lg bg-red-50 dark:bg-red-900/20 p-6 text-center"
    >
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-red-700 dark:text-red-300">
        {error.message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 rounded-md bg-red-100 dark:bg-red-800 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  ), []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <div className="space-y-6">
        <PageHeader
          heading="Interviews"
          description="Manage and monitor AI-powered interview sessions"
          actions={
            <Button
              onClick={handleScheduleClick}
              aria-label="Schedule new interview"
              className="gap-2"
            >
              Schedule Interview
            </Button>
          }
        />

        {renderConnectionStatus()}

        <div className="px-4 sm:px-6 lg:px-8">
          <InterviewList
            interviews={interview || []}
            isLoading={loading.isInitializing}
            onSort={(column, direction) => {
              track('interview_list_sorted', {
                column,
                direction,
                timestamp: new Date().toISOString()
              });
            }}
            onFilter={(filters) => {
              track('interview_list_filtered', {
                filters,
                timestamp: new Date().toISOString()
              });
            }}
            onStatusUpdate={(id, status) => {
              track('interview_status_updated', {
                id,
                status,
                timestamp: new Date().toISOString()
              });
            }}
            ariaLabel="Interview sessions list"
            className="rounded-lg border border-gray-200 dark:border-gray-800"
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default InterviewsPage;