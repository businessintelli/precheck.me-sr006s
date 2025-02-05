import React, { useCallback, useMemo, useState } from 'react'; // ^18.0.0
import { format } from 'date-fns'; // ^2.30.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { useTheme } from '@mui/material'; // ^5.0.0

import { Interview, InterviewStatus, InterviewType } from '../../types/interview.types';
import Table from '../shared/Table';
import { useWebSocket } from '../../hooks/useWebSocket';
import { cn } from '../../lib/utils';
import { NotificationType } from '../../types/notification.types';

// Props interface with comprehensive type safety
interface InterviewListProps {
  interviews: Interview[];
  isLoading: boolean;
  onSort: (column: string, direction: 'asc' | 'desc') => void;
  onFilter: (filters: FilterCriteria) => void;
  onStatusUpdate: (id: string, status: InterviewStatus) => void;
  ariaLabel?: string;
  className?: string;
}

// Filter criteria type for enhanced filtering
interface FilterCriteria {
  type?: InterviewType[];
  status?: InterviewStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Table column configuration with accessibility support
const TABLE_COLUMNS = [
  {
    key: 'scheduledAt',
    header: 'Date & Time',
    sortable: true,
    render: (value: Date) => format(value, 'PPp'),
    ariaLabel: 'Sort by date and time'
  },
  {
    key: 'type',
    header: 'Interview Type',
    sortable: true,
    render: (value: InterviewType) => (
      <span className={cn(
        'px-2 py-1 rounded-full text-sm font-medium',
        {
          'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300': value === InterviewType.TECHNICAL,
          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300': value === InterviewType.BEHAVIORAL,
          'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300': value === InterviewType.MANAGEMENT
        }
      )}>
        {value}
      </span>
    ),
    ariaLabel: 'Sort by interview type'
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (value: InterviewStatus) => (
      <span className={cn(
        'px-2 py-1 rounded-full text-sm font-medium',
        {
          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300': value === InterviewStatus.SCHEDULED,
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300': value === InterviewStatus.IN_PROGRESS,
          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300': value === InterviewStatus.COMPLETED,
          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300': value === InterviewStatus.FAILED,
          'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300': value === InterviewStatus.CANCELLED
        }
      )}>
        {value}
      </span>
    ),
    ariaLabel: 'Sort by status'
  },
  {
    key: 'duration',
    header: 'Duration',
    sortable: true,
    render: (value: number) => `${value} minutes`,
    ariaLabel: 'Sort by duration'
  }
];

// Custom hook for managing real-time interview updates
const useInterviewUpdates = (onStatusUpdate: (id: string, status: InterviewStatus) => void) => {
  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  React.useEffect(() => {
    const handleStatusUpdate = (data: any) => {
      if (data.interviewId && data.status) {
        onStatusUpdate(data.interviewId, data.status as InterviewStatus);
      }
    };

    subscribe(NotificationType.INTERVIEW_READY, handleStatusUpdate);

    return () => {
      unsubscribe(NotificationType.INTERVIEW_READY, handleStatusUpdate);
    };
  }, [subscribe, unsubscribe, onStatusUpdate]);
};

// Main InterviewList component with enhanced features
const InterviewList: React.FC<InterviewListProps> = React.memo(({
  interviews,
  isLoading,
  onSort,
  onFilter,
  onStatusUpdate,
  ariaLabel = 'Interview list',
  className
}) => {
  // Theme and responsive layout management
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Virtual scrolling setup for performance
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: interviews.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5
  });

  // Set up real-time updates
  useInterviewUpdates(onStatusUpdate);

  // Memoized table data
  const tableData = useMemo(() => interviews.map(interview => ({
    ...interview,
    id: interview.id // Ensure unique key for virtualization
  })), [interviews]);

  return (
    <div
      ref={parentRef}
      className={cn(
        'relative w-full overflow-auto',
        'border border-gray-200 dark:border-gray-800 rounded-lg',
        className
      )}
      style={{
        height: '100%',
        maxHeight: 'calc(100vh - 200px)' // Adjust based on layout
      }}
    >
      <Table
        data={tableData}
        columns={TABLE_COLUMNS}
        isLoading={isLoading}
        onSort={onSort}
        ariaLabel={ariaLabel}
        stickyHeader
        virtualScroll
        className={cn(
          'w-full',
          isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
        )}
      />
    </div>
  );
});

// Display name for debugging
InterviewList.displayName = 'InterviewList';

export default InterviewList;