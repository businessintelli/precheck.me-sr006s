import React, { useEffect, useCallback, memo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import Card from '../shared/Card';
import CheckTimeline from './CheckTimeline';
import { useBackgroundCheck } from '../../hooks/useBackgroundCheck';
import { useWebSocket } from '../../hooks/useWebSocket';
import { BackgroundCheckStatus, VerificationResult } from '../../types/background-check.types';
import { DocumentType } from '../../types/document.types';
import { formatDate } from '../../utils/date';
import { NotificationType } from '../../types/notification.types';

// Constants for verification types and status badges
const VERIFICATION_TYPES = {
  IDENTITY: 'Identity Verification',
  EMPLOYMENT: 'Employment History',
  EDUCATION: 'Education Records',
  CRIMINAL: 'Criminal Background'
} as const;

const STATUS_BADGES = {
  VERIFIED: 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-300',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-300',
  EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-300'
} as const;

// Component props interface
interface CheckDetailsProps {
  backgroundCheckId: string;
  className?: string;
  onStatusChange?: (status: BackgroundCheckStatus) => void;
}

// Helper function to render verification results
const renderVerificationResults = (results: Record<string, VerificationResult>) => {
  return Object.entries(results).map(([type, result]) => (
    <div
      key={type}
      className="flex items-center justify-between p-4 border-b last:border-b-0 dark:border-gray-700"
      role="listitem"
    >
      <div className="flex flex-col">
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {VERIFICATION_TYPES[type as keyof typeof VERIFICATION_TYPES]}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {result.verifiedBy && `Verified by ${result.verifiedBy}`}
        </span>
      </div>
      <div className="flex items-center space-x-4">
        <span
          className={classNames(
            'px-3 py-1 rounded-full text-sm font-medium',
            result.verified ? STATUS_BADGES.VERIFIED : STATUS_BADGES.FAILED
          )}
          role="status"
        >
          {result.verified ? 'Verified' : 'Failed'}
        </span>
        {result.verifiedAt && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(result.verifiedAt)}
          </span>
        )}
      </div>
    </div>
  ));
};

const CheckDetails: React.FC<CheckDetailsProps> = memo(({
  backgroundCheckId,
  className,
  onStatusChange
}) => {
  const {
    backgroundCheck,
    isLoading,
    error,
    refetch
  } = useBackgroundCheck(backgroundCheckId);

  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  // Handle real-time status updates
  const handleStatusUpdate = useCallback((data: any) => {
    if (data.checkId === backgroundCheckId) {
      refetch();
      onStatusChange?.(data.status as BackgroundCheckStatus);
    }
  }, [backgroundCheckId, refetch, onStatusChange]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    subscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    return () => {
      unsubscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    };
  }, [subscribe, unsubscribe, handleStatusUpdate]);

  // Loading state
  if (isLoading) {
    return (
      <Card className={classNames('animate-pulse', className)} aria-busy="true">
        <div className="space-y-4 p-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={classNames('p-4 text-center', className)} role="alert">
        <p className="text-red-500 dark:text-red-400 mb-2">
          {error.message || 'Failed to load background check details'}
        </p>
        <button
          onClick={() => refetch()}
          className="text-blue-500 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2"
          aria-label="Retry loading background check details"
        >
          Retry
        </button>
      </Card>
    );
  }

  // No data state
  if (!backgroundCheck) {
    return (
      <Card className={classNames('p-4 text-center', className)}>
        <p className="text-gray-500 dark:text-gray-400">
          No background check details available
        </p>
      </Card>
    );
  }

  return (
    <div className={classNames('space-y-6', className)} role="region" aria-label="Background check details">
      {/* Candidate Information */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Candidate Information
          </h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Check ID
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {backgroundCheck.id}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </dt>
              <dd className="mt-1">
                <span
                  className={classNames(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    STATUS_BADGES[backgroundCheck.status === BackgroundCheckStatus.COMPLETED ? 'VERIFIED' : 'PENDING']
                  )}
                >
                  {backgroundCheck.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Requested By
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {backgroundCheck.requestedBy}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Created At
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {formatDate(backgroundCheck.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Verification Results */}
      <Card>
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Verification Results
          </h2>
          <div role="list" className="divide-y dark:divide-gray-700">
            {renderVerificationResults(backgroundCheck.verificationResults)}
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <CheckTimeline
        events={[
          {
            status: backgroundCheck.status,
            timestamp: backgroundCheck.createdAt,
            description: 'Background check initiated',
            eventType: 'info'
          },
          // Add more timeline events based on verification results
          ...Object.entries(backgroundCheck.verificationResults)
            .filter(([_, result]) => result.verifiedAt)
            .map(([type, result]) => ({
              status: backgroundCheck.status,
              timestamp: result.verifiedAt,
              description: `${VERIFICATION_TYPES[type as keyof typeof VERIFICATION_TYPES]} ${result.verified ? 'verified' : 'failed'}`,
              eventType: result.verified ? 'success' : 'error' as const
            }))
        ]}
        currentStatus={backgroundCheck.status}
      />
    </div>
  );
});

CheckDetails.displayName = 'CheckDetails';

export default CheckDetails;