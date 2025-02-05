import React, { useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // ^10.0.0
import { clsx } from 'clsx'; // ^2.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { BackgroundCheck, BackgroundCheckStatus } from '../../types/background-check.types';
import { Card } from '../shared/Card';
import { useBackgroundCheck } from '../../hooks/useBackgroundCheck';

// Status color mapping following Material Design color system
const STATUS_COLORS = {
  [BackgroundCheckStatus.INITIATED]: 'bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-100',
  [BackgroundCheckStatus.DOCUMENTS_PENDING]: 'bg-amber-100 text-amber-800 dark:bg-amber-800/20 dark:text-amber-100',
  [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800/20 dark:text-indigo-100',
  [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: 'bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-100',
  [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: 'bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-100',
  [BackgroundCheckStatus.INTERVIEW_COMPLETED]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-800/20 dark:text-cyan-100',
  [BackgroundCheckStatus.COMPLETED]: 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-100',
  [BackgroundCheckStatus.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-100',
  [BackgroundCheckStatus.CANCELLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-100'
} as const;

// Progress mapping for status stages
const STATUS_PROGRESS = {
  [BackgroundCheckStatus.INITIATED]: 10,
  [BackgroundCheckStatus.DOCUMENTS_PENDING]: 20,
  [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: 40,
  [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: 60,
  [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: 70,
  [BackgroundCheckStatus.INTERVIEW_COMPLETED]: 80,
  [BackgroundCheckStatus.COMPLETED]: 100,
  [BackgroundCheckStatus.REJECTED]: 100,
  [BackgroundCheckStatus.CANCELLED]: 100
} as const;

interface CheckStatusProps {
  backgroundCheckId: string;
  className?: string;
  onStatusChange?: (status: BackgroundCheckStatus) => void;
}

/**
 * Component for displaying background check status with real-time updates
 * Implements Material Design principles and accessibility features
 */
const CheckStatus: React.FC<CheckStatusProps> = memo(({ 
  backgroundCheckId, 
  className,
  onStatusChange 
}) => {
  const statusRef = useRef<HTMLDivElement>(null);
  const { 
    backgroundCheck,
    isLoading,
    error,
    isRealTimeEnabled,
    setIsRealTimeEnabled
  } = useBackgroundCheck(backgroundCheckId);

  // Handle status changes with animation
  useEffect(() => {
    if (backgroundCheck?.status && onStatusChange) {
      onStatusChange(backgroundCheck.status);
    }
  }, [backgroundCheck?.status, onStatusChange]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg" role="alert">
      <p className="text-red-800 dark:text-red-200">Failed to load status: {error.message}</p>
    </div>
  );

  if (isLoading) {
    return (
      <Card className={clsx('animate-pulse', className)}>
        <div className="h-24 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  if (!backgroundCheck) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Card 
        className={clsx('overflow-hidden', className)}
        aria-live="polite"
        ref={statusRef}
      >
        <div className="space-y-4 p-4">
          {/* Status Badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={backgroundCheck.status}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={clsx(
                'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                STATUS_COLORS[backgroundCheck.status]
              )}
            >
              <span className="relative flex h-2 w-2 mr-2">
                <span className={clsx(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                  backgroundCheck.status === BackgroundCheckStatus.VERIFICATION_IN_PROGRESS && 'bg-purple-400'
                )} />
                <span className={clsx(
                  'relative inline-flex rounded-full h-2 w-2',
                  backgroundCheck.status === BackgroundCheckStatus.VERIFICATION_IN_PROGRESS && 'bg-purple-500'
                )} />
              </span>
              {backgroundCheck.status.replace(/_/g, ' ')}
            </motion.div>
          </AnimatePresence>

          {/* Progress Bar */}
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-primary">
                  Progress
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-primary">
                  {STATUS_PROGRESS[backgroundCheck.status]}%
                </span>
              </div>
            </div>
            <motion.div 
              className="overflow-hidden h-2 text-xs flex rounded bg-primary/10"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
            >
              <motion.div
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary"
                initial={{ width: '0%' }}
                animate={{ width: `${STATUS_PROGRESS[backgroundCheck.status]}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </motion.div>
          </div>

          {/* Real-time Updates Toggle */}
          <div className="flex items-center justify-end mt-4">
            <button
              onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
              className={clsx(
                'inline-flex items-center text-xs text-gray-500 dark:text-gray-400',
                'hover:text-primary transition-colors'
              )}
              aria-pressed={isRealTimeEnabled}
            >
              <span className={clsx(
                'w-8 h-4 mr-2 bg-gray-200 rounded-full',
                isRealTimeEnabled && 'bg-primary'
              )}>
                <motion.span
                  className="block w-3 h-3 mt-0.5 ml-0.5 bg-white rounded-full"
                  animate={{ x: isRealTimeEnabled ? 16 : 0 }}
                />
              </span>
              Real-time updates
            </button>
          </div>
        </div>
      </Card>
    </ErrorBoundary>
  );
});

CheckStatus.displayName = 'CheckStatus';

export default CheckStatus;