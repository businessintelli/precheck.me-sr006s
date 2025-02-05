import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // ^10.0.0
import { useTheme } from '@mui/material'; // ^5.0.0
import classNames from 'classnames'; // ^2.3.2
import Card from '../shared/Card';
import { formatDate } from '../../utils/date';
import { BackgroundCheckStatus } from '../../types/background-check.types';

// Timeline event type definition
export type TimelineEventType = 'success' | 'warning' | 'error' | 'info' | 'pending';

// Timeline event interface
export interface TimelineEvent {
  status: BackgroundCheckStatus;
  timestamp: Date;
  description: string;
  metadata?: Record<string, unknown>;
  eventType: TimelineEventType;
  isError?: boolean;
  retryCount?: number;
}

// Component props interface
export interface CheckTimelineProps {
  events: TimelineEvent[];
  currentStatus: BackgroundCheckStatus;
  className?: string;
  onEventClick?: (event: TimelineEvent) => void;
  isLoading?: boolean;
  error?: Error | null;
  retry?: () => void;
}

// Status color mapping with dark mode support
const STATUS_COLORS: Record<BackgroundCheckStatus, string> = {
  [BackgroundCheckStatus.INITIATED]: 'bg-blue-500 dark:bg-blue-400',
  [BackgroundCheckStatus.DOCUMENTS_PENDING]: 'bg-yellow-500 dark:bg-yellow-400',
  [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: 'bg-blue-400 dark:bg-blue-300',
  [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: 'bg-purple-500 dark:bg-purple-400',
  [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: 'bg-indigo-500 dark:bg-indigo-400',
  [BackgroundCheckStatus.INTERVIEW_COMPLETED]: 'bg-indigo-600 dark:bg-indigo-500',
  [BackgroundCheckStatus.COMPLETED]: 'bg-green-500 dark:bg-green-400',
  [BackgroundCheckStatus.REJECTED]: 'bg-red-500 dark:bg-red-400',
  [BackgroundCheckStatus.CANCELLED]: 'bg-gray-500 dark:bg-gray-400'
};

// Status labels for accessibility
const STATUS_LABELS: Record<BackgroundCheckStatus, string> = {
  [BackgroundCheckStatus.INITIATED]: 'Check Initiated',
  [BackgroundCheckStatus.DOCUMENTS_PENDING]: 'Documents Required',
  [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: 'Documents Received',
  [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: 'Verification in Progress',
  [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: 'Interview Scheduled',
  [BackgroundCheckStatus.INTERVIEW_COMPLETED]: 'Interview Completed',
  [BackgroundCheckStatus.COMPLETED]: 'Check Completed',
  [BackgroundCheckStatus.REJECTED]: 'Check Rejected',
  [BackgroundCheckStatus.CANCELLED]: 'Check Cancelled'
};

// Animation variants for timeline events
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

// Get status color based on theme mode
const getStatusColor = (status: BackgroundCheckStatus, isDarkMode: boolean): string => {
  const baseColor = STATUS_COLORS[status];
  return isDarkMode ? baseColor.replace('bg-', 'dark:bg-') : baseColor;
};

// Memoized timeline component for performance
const CheckTimeline: React.FC<CheckTimelineProps> = React.memo(({
  events,
  currentStatus,
  className,
  onEventClick,
  isLoading = false,
  error = null,
  retry
}) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Sort events by timestamp
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [events]);

  // Render loading state
  if (isLoading) {
    return (
      <Card
        className={classNames('p-4', className)}
        aria-busy="true"
        aria-label="Loading timeline"
      >
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="h-4 w-4 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card
        className={classNames('p-4 text-center', className)}
        role="alert"
        aria-label="Timeline error"
      >
        <p className="text-red-500 dark:text-red-400 mb-2">{error.message}</p>
        {retry && (
          <button
            onClick={retry}
            className="text-blue-500 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2"
            aria-label="Retry loading timeline"
          >
            Retry
          </button>
        )}
      </Card>
    );
  }

  return (
    <div
      className={classNames('relative space-y-4', className)}
      role="region"
      aria-label="Background check timeline"
    >
      <AnimatePresence mode="wait">
        {sortedEvents.map((event, index) => {
          const isActive = event.status === currentStatus;
          const statusColor = getStatusColor(event.status, isDarkMode);

          return (
            <motion.div
              key={`${event.status}-${event.timestamp.getTime()}`}
              variants={ANIMATION_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, delay: index * 0.1 }}
              className="relative pl-8"
            >
              {/* Timeline connector */}
              {index < sortedEvents.length - 1 && (
                <div
                  className="absolute left-[0.9375rem] top-8 -bottom-4 w-px bg-gray-200 dark:bg-gray-700"
                  aria-hidden="true"
                />
              )}

              {/* Timeline node */}
              <div className="relative flex items-start">
                <span
                  className={classNames(
                    'absolute left-0 flex h-7 w-7 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-900',
                    statusColor,
                    isActive && 'animate-pulse'
                  )}
                  aria-hidden="true"
                />

                <Card
                  className={classNames(
                    'flex-1 ml-4 cursor-pointer transition-shadow hover:shadow-md',
                    isActive && 'ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400'
                  )}
                  onClick={() => onEventClick?.(event)}
                  role="button"
                  aria-label={`${STATUS_LABELS[event.status]} - ${formatDate(event.timestamp)}`}
                  tabIndex={0}
                >
                  <div className="flex justify-between items-start p-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {STATUS_LABELS[event.status]}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {event.description}
                      </p>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <dl className="mt-2 text-sm">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <div key={key} className="mt-1">
                              <dt className="inline font-medium text-gray-500 dark:text-gray-400">
                                {key}:
                              </dt>
                              <dd className="inline ml-1 text-gray-900 dark:text-gray-100">
                                {String(value)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </div>
                    <time
                      className="text-sm text-gray-500 dark:text-gray-400"
                      dateTime={event.timestamp.toISOString()}
                    >
                      {formatDate(event.timestamp)}
                    </time>
                  </div>
                </Card>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
});

CheckTimeline.displayName = 'CheckTimeline';

export default CheckTimeline;