import React, { useCallback, useEffect, useMemo, useState } from 'react'; // ^18.0.0
import { format } from 'date-fns'; // ^2.30.0
import { Badge } from '@radix-ui/react-badge'; // ^1.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { Table, VirtualizedTable } from '../shared/Table';
import { Document, DocumentStatus, DocumentType } from '../../types/document.types';
import { useDocument } from '../../hooks/useDocument';
import { cn } from '../../lib/utils';

// Constants for component configuration
const VIRTUALIZATION_THRESHOLD = 100;
const DATE_FORMAT = 'MMM dd, yyyy HH:mm';

// Status color mapping for visual feedback
const STATUS_COLORS: Record<DocumentStatus, string> = {
  [DocumentStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  [DocumentStatus.PROCESSING]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  [DocumentStatus.VERIFIED]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  [DocumentStatus.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  [DocumentStatus.ERROR]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  [DocumentStatus.REQUIRES_MANUAL_REVIEW]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  [DocumentStatus.EXPIRED]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
};

// Interface for component props
interface DocumentListProps {
  documents: Document[];
  isLoading?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  className?: string;
  virtualizeAfter?: number;
  onDocumentSelect?: (document: Document) => void;
  accessLevel?: 'read' | 'write' | 'admin';
  showVerificationDetails?: boolean;
}

/**
 * A comprehensive document list component that provides secure, accessible,
 * and responsive display of verification documents with real-time updates
 */
const DocumentList = React.memo(({
  documents,
  isLoading = false,
  onSort,
  className,
  virtualizeAfter = VIRTUALIZATION_THRESHOLD,
  onDocumentSelect,
  accessLevel = 'read',
  showVerificationDetails = false
}: DocumentListProps): JSX.Element => {
  // State management
  const [sortColumn, setSortColumn] = useState<string>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Document subscription hook for real-time updates
  const { subscribeToUpdates } = useDocument('');

  // Set up virtualization if needed
  const shouldVirtualize = documents.length > (virtualizeAfter || VIRTUALIZATION_THRESHOLD);
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 5
  });

  // Configure table columns based on access level and screen size
  const columns = useMemo(() => [
    {
      key: 'type',
      header: 'Document Type',
      sortable: true,
      render: (value: DocumentType) => (
        <span className="capitalize">
          {value.toLowerCase().replace('_', ' ')}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value: DocumentStatus) => (
        <Badge
          className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            STATUS_COLORS[value]
          )}
          aria-label={`Status: ${value.toLowerCase().replace('_', ' ')}`}
        >
          {value.toLowerCase().replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'uploadedAt',
      header: 'Upload Date',
      sortable: true,
      render: (value: Date) => format(new Date(value), DATE_FORMAT)
    },
    {
      key: 'verifiedAt',
      header: 'Verification Date',
      sortable: true,
      hidden: !showVerificationDetails,
      render: (value: Date | null) => 
        value ? format(new Date(value), DATE_FORMAT) : '-'
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      hidden: accessLevel === 'read',
      render: (_: any, document: Document) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onDocumentSelect?.(document)}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            aria-label={`View ${document.fileName}`}
          >
            View
          </button>
          {accessLevel === 'admin' && (
            <button
              onClick={() => handleDocumentDelete(document.id)}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              aria-label={`Delete ${document.fileName}`}
            >
              Delete
            </button>
          )}
        </div>
      )
    }
  ].filter(col => !col.hidden), [accessLevel, showVerificationDetails]);

  // Handle sort changes
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDirection(direction);
    onSort?.(column, direction);
  }, [onSort]);

  // Handle document deletion (admin only)
  const handleDocumentDelete = useCallback((documentId: string) => {
    // Implementation would go here
    console.log('Delete document:', documentId);
  }, []);

  // Subscribe to document updates
  useEffect(() => {
    const unsubscribe = documents.map(doc => 
      subscribeToUpdates(doc.id, (updatedDoc) => {
        // Handle document updates
        console.log('Document updated:', updatedDoc);
      })
    );

    return () => {
      unsubscribe.forEach(unsub => unsub());
    };
  }, [documents, subscribeToUpdates]);

  // Error boundary fallback
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div className="p-4 text-red-600 dark:text-red-400">
      <p>Error loading documents: {error.message}</p>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div
        className={cn(
          'rounded-lg border border-gray-200 dark:border-gray-800',
          className
        )}
        ref={parentRef}
      >
        {shouldVirtualize ? (
          <VirtualizedTable
            data={documents}
            columns={columns}
            virtualizer={virtualizer}
            isLoading={isLoading}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            ariaLabel="Document verification list"
          />
        ) : (
          <Table
            data={documents}
            columns={columns}
            isLoading={isLoading}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            ariaLabel="Document verification list"
          />
        )}
      </div>
    </ErrorBoundary>
  );
});

// Display name for debugging
DocumentList.displayName = 'DocumentList';

export default DocumentList;