import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { Table, TableSkeleton } from '../shared/Table';
import { useBackgroundCheck } from '../../hooks/useBackgroundCheck';
import { useWebSocket } from '../../hooks/useWebSocket';
import { BackgroundCheck, BackgroundCheckStatus } from '../../types/background-check.types';
import { NotificationType } from '../../types/notification.types';
import { cn } from '../../lib/utils';

// Constants for table configuration
const VIRTUAL_ROW_HEIGHT = 56; // Material Design 3.0 standard row height
const DEFAULT_PAGE_SIZE = 10;

// Status style mapping following Material Design 3.0 color system
const STATUS_STYLES: Record<BackgroundCheckStatus, string> = {
  [BackgroundCheckStatus.INITIATED]: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  [BackgroundCheckStatus.DOCUMENTS_PENDING]: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
  [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
  [BackgroundCheckStatus.INTERVIEW_COMPLETED]: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
  [BackgroundCheckStatus.COMPLETED]: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  [BackgroundCheckStatus.REJECTED]: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  [BackgroundCheckStatus.CANCELLED]: 'bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
};

export interface BackgroundCheckFilters {
  status?: BackgroundCheckStatus[];
  dateRange?: { start: Date; end: Date };
  search?: string;
}

export interface CheckListProps {
  organizationId: string;
  className?: string;
  initialFilters?: BackgroundCheckFilters;
  onStatusChange?: (checkId: string, status: BackgroundCheckStatus) => void;
  virtualScrolling?: boolean;
}

const CheckList: React.FC<CheckListProps> = React.memo(({
  organizationId,
  className,
  initialFilters,
  onStatusChange,
  virtualScrolling = false
}) => {
  // State management
  const [filters, setFilters] = useState<BackgroundCheckFilters>(initialFilters || {});
  const [sortColumn, setSortColumn] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Hooks for data fetching and real-time updates
  const {
    backgroundCheck: checks,
    isLoading,
    error,
    refetch
  } = useBackgroundCheck();

  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  // Virtual scrolling setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: checks?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => VIRTUAL_ROW_HEIGHT,
    overscan: 5
  });

  // Table columns configuration
  const TABLE_COLUMNS = useMemo(() => [
    {
      key: 'id',
      header: 'Reference ID',
      width: '120px',
      render: (value: string) => (
        <span className="font-mono text-sm">{value.slice(0, 8)}</span>
      )
    },
    {
      key: 'candidateId',
      header: 'Candidate',
      width: '200px',
      sortable: true
    },
    {
      key: 'type',
      header: 'Check Type',
      width: '150px',
      sortable: true,
      align: 'center' as const
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      sortable: true,
      render: (value: BackgroundCheckStatus) => (
        <span
          className={cn(
            'px-2 py-1 rounded-full text-xs font-medium inline-flex items-center justify-center',
            STATUS_STYLES[value]
          )}
          role="status"
        >
          {value}
        </span>
      )
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: '150px',
      sortable: true,
      render: (value: string) => format(new Date(value), 'MMM dd, yyyy')
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      width: '150px',
      sortable: true,
      render: (value: string) => format(new Date(value), 'MMM dd, yyyy HH:mm')
    }
  ], []);

  // Handle real-time status updates
  const handleStatusUpdate = useCallback((data: any) => {
    if (data.organizationId === organizationId) {
      refetch();
      onStatusChange?.(data.checkId, data.status);
    }
  }, [organizationId, refetch, onStatusChange]);

  // Subscribe to real-time updates
  useEffect(() => {
    subscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    return () => {
      unsubscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    };
  }, [subscribe, unsubscribe, handleStatusUpdate]);

  // Handle sorting
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
  }, []);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    if (!checks) return [];

    let filtered = [...checks];

    // Apply filters
    if (filters.status?.length) {
      filtered = filtered.filter(check => filters.status?.includes(check.status));
    }
    if (filters.dateRange) {
      filtered = filtered.filter(check => {
        const checkDate = new Date(check.createdAt);
        return checkDate >= filters.dateRange!.start && checkDate <= filters.dateRange!.end;
      });
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(check =>
        check.id.toLowerCase().includes(searchLower) ||
        check.candidateId.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortColumn as keyof BackgroundCheck];
      const bValue = b[sortColumn as keyof BackgroundCheck];
      const modifier = sortDirection === 'asc' ? 1 : -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }
      return ((aValue as any) - (bValue as any)) * modifier;
    });

    return filtered;
  }, [checks, filters, sortColumn, sortDirection]);

  if (error) {
    return (
      <div className="p-4 text-red-600 dark:text-red-400 text-center" role="alert">
        Error loading background checks: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return <TableSkeleton columns={TABLE_COLUMNS.length} rows={DEFAULT_PAGE_SIZE} />;
  }

  return (
    <div
      ref={parentRef}
      className={cn('relative overflow-hidden rounded-lg border', className)}
    >
      <Table
        data={virtualScrolling ? rowVirtualizer.getVirtualItems() : filteredAndSortedData}
        columns={TABLE_COLUMNS}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        virtualScroll={virtualScrolling}
        ariaLabel="Background Checks List"
        stickyHeader
        className="w-full"
      />
    </div>
  );
});

CheckList.displayName = 'CheckList';

export default CheckList;