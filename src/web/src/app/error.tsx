'use client';

import React, { useEffect } from 'react'; // @version ^18.0.0
import { motion } from 'framer-motion'; // @version ^10.0.0
import { captureError } from '@sentry/nextjs'; // @version ^7.0.0
import { ErrorOutline as ErrorIcon } from '@mui/icons-material'; // @version ^5.0.0
import { Button } from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import { cn } from '../../lib/utils';

// Error message mapping for different error types
const ERROR_MESSAGES = {
  default: 'An unexpected error occurred. Please try again.',
  network: 'Network error. Please check your connection.',
  server: 'Server error. Please try again later.',
  timeout: 'Request timed out. Please try again.',
  validation: 'Invalid data. Please check your input.'
} as const;

// Constants for retry mechanism
const RETRY_DELAY = 3000;
const MAX_RETRY_ATTEMPTS = 3;

interface ErrorProps {
  error: Error;
  reset: () => void;
}

/**
 * Error boundary component that catches and displays runtime errors
 * with Material Design styling and accessibility support
 */
export default function Error({ error, reset }: ErrorProps) {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  useEffect(() => {
    // Log error to Sentry for monitoring
    captureError(error, {
      level: 'error',
      extra: {
        retryCount,
        componentStack: error.stack
      }
    });
  }, [error, retryCount]);

  // Determine appropriate error message based on error type
  const getErrorMessage = (error: Error): string => {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES.network;
    }
    if (error.message.includes('timeout')) {
      return ERROR_MESSAGES.timeout;
    }
    if (error.message.includes('validation')) {
      return ERROR_MESSAGES.validation;
    }
    if (error.message.includes('500')) {
      return ERROR_MESSAGES.server;
    }
    return ERROR_MESSAGES.default;
  };

  // Handle reset with rate limiting and tracking
  const handleReset = async () => {
    if (retryCount >= MAX_RETRY_ATTEMPTS || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    try {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      reset();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900"
      role="main"
      aria-labelledby="error-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card
          variant="elevated"
          padding="lg"
          className="text-center"
          role="alert"
          aria-live="assertive"
        >
          <ErrorIcon
            className={cn(
              'w-16 h-16 mx-auto mb-4',
              'text-red-500 dark:text-red-400'
            )}
            aria-hidden="true"
          />
          
          <h1
            id="error-title"
            className={cn(
              'text-xl font-semibold mb-2',
              'text-gray-900 dark:text-gray-100'
            )}
          >
            Something went wrong
          </h1>
          
          <p
            className={cn(
              'text-base mb-6',
              'text-gray-600 dark:text-gray-300'
            )}
          >
            {getErrorMessage(error)}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleReset}
              isLoading={isRetrying}
              disabled={retryCount >= MAX_RETRY_ATTEMPTS}
              aria-label="Try again"
              className="w-full"
            >
              Try again
            </Button>
            
            {retryCount >= MAX_RETRY_ATTEMPTS && (
              <p
                className={cn(
                  'text-sm',
                  'text-gray-500 dark:text-gray-400'
                )}
                role="status"
              >
                Maximum retry attempts reached. Please refresh the page or try again later.
              </p>
            )}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}