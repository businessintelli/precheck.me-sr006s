import React, { memo, useEffect, useState, useCallback } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import { Document, DocumentStatus } from '../../types/document.types';
import { useDocument } from '../../hooks/useDocument';
import Card from '../shared/Card';

// Constants for status messages with i18n support
const STATUS_MESSAGES = {
  PENDING: 'Document queued for verification...',
  PROCESSING: 'Verifying document integrity and contents...',
  VERIFIED: 'Document verified successfully',
  REJECTED: 'Document verification failed - See details below',
  ERROR: 'Error during verification - Please try again',
  MANUAL_REVIEW: 'Document flagged for manual review'
} as const;

// Constants for status colors with dark mode support
const STATUS_COLORS = {
  PENDING: 'text-yellow-500 dark:text-yellow-400',
  PROCESSING: 'text-blue-500 dark:text-blue-400',
  VERIFIED: 'text-green-500 dark:text-green-400',
  REJECTED: 'text-red-500 dark:text-red-400',
  ERROR: 'text-red-500 dark:text-red-400',
  MANUAL_REVIEW: 'text-orange-500 dark:text-orange-400'
} as const;

// Configuration for verification polling
const POLLING_CONFIG = {
  INITIAL_INTERVAL: 1000,
  MAX_INTERVAL: 10000,
  BACKOFF_FACTOR: 1.5,
  MAX_RETRIES: 5
} as const;

// Confidence score threshold for automatic verification
const CONFIDENCE_THRESHOLD = 0.8;

interface DocumentVerificationProps {
  documentId: string;
  className?: string;
  onVerificationComplete?: (result: Document['verificationResult']) => void;
  onVerificationError?: (error: Error) => void;
  onManualReviewRequested?: () => void;
  showConfidenceScore?: boolean;
  autoRetry?: boolean;
}

const DocumentVerification = memo(({
  documentId,
  className,
  onVerificationComplete,
  onVerificationError,
  onManualReviewRequested,
  showConfidenceScore = true,
  autoRetry = true
}: DocumentVerificationProps) => {
  // State for polling interval management
  const [pollInterval, setPollInterval] = useState(POLLING_CONFIG.INITIAL_INTERVAL);
  const [retryCount, setRetryCount] = useState(0);

  // Custom hook for document management
  const { document, getDocumentStatus, requestManualReview, retryVerification } = useDocument(documentId);

  // Status color utility function
  const getStatusColor = useCallback((status: DocumentStatus, confidenceScore?: number) => {
    if (status === DocumentStatus.VERIFIED && confidenceScore && confidenceScore < CONFIDENCE_THRESHOLD) {
      return STATUS_COLORS.MANUAL_REVIEW;
    }
    return STATUS_COLORS[status] || STATUS_COLORS.ERROR;
  }, []);

  // Handle verification status updates
  useEffect(() => {
    if (!document) return;

    if (document.status === DocumentStatus.VERIFIED) {
      onVerificationComplete?.(document.verificationResult);
      return;
    }

    if (document.status === DocumentStatus.ERROR && autoRetry && retryCount < POLLING_CONFIG.MAX_RETRIES) {
      const timer = setTimeout(async () => {
        try {
          await retryVerification();
          setRetryCount(prev => prev + 1);
          setPollInterval(prev => Math.min(prev * POLLING_CONFIG.BACKOFF_FACTOR, POLLING_CONFIG.MAX_INTERVAL));
        } catch (error) {
          onVerificationError?.(error as Error);
        }
      }, pollInterval);

      return () => clearTimeout(timer);
    }
  }, [document, pollInterval, retryCount, autoRetry, onVerificationComplete, onVerificationError, retryVerification]);

  // Polling effect for status updates
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        await getDocumentStatus();
      } catch (error) {
        console.error('Failed to fetch document status:', error);
      }
    }, pollInterval);

    return () => clearInterval(timer);
  }, [getDocumentStatus, pollInterval]);

  if (!document) {
    return null;
  }

  return (
    <Card
      className={classNames('overflow-hidden', className)}
      variant="bordered"
      role="region"
      aria-label="Document Verification Status"
    >
      <div className="p-4 space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Verification Status
          </h3>
          <span
            className={classNames(
              'px-3 py-1 rounded-full text-sm font-medium',
              getStatusColor(document.status, document.verificationResult?.confidenceScore)
            )}
            role="status"
            aria-live="polite"
          >
            {STATUS_MESSAGES[document.status]}
          </span>
        </div>

        {/* Confidence Score */}
        {showConfidenceScore && document.verificationResult?.confidenceScore && (
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-medium">Confidence Score</span>
              <span className="text-sm font-medium">
                {Math.round(document.verificationResult.confidenceScore * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div
                className={classNames(
                  'h-2 rounded-full transition-all duration-500',
                  document.verificationResult.confidenceScore >= CONFIDENCE_THRESHOLD
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                )}
                style={{ width: `${document.verificationResult.confidenceScore * 100}%` }}
                role="progressbar"
                aria-valuenow={document.verificationResult.confidenceScore * 100}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* Verification Issues */}
        {document.verificationResult?.issues?.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Verification Issues</h4>
            <ul className="space-y-2" role="list">
              {document.verificationResult.issues.map((issue, index) => (
                <li
                  key={index}
                  className="text-sm text-red-600 dark:text-red-400"
                  role="listitem"
                >
                  • {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-4">
          {document.status === DocumentStatus.ERROR && (
            <button
              onClick={() => retryVerification()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              disabled={retryCount >= POLLING_CONFIG.MAX_RETRIES}
            >
              Retry Verification
            </button>
          )}
          {document.status !== DocumentStatus.VERIFIED && (
            <button
              onClick={() => {
                requestManualReview();
                onManualReviewRequested?.();
              }}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Request Manual Review
            </button>
          )}
        </div>
      </div>
    </Card>
  );
});

DocumentVerification.displayName = 'DocumentVerification';

export default DocumentVerification;