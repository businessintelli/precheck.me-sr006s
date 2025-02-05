import React from 'react'; // ^18.0.0
import { ChevronUp, ChevronDown } from 'lucide-react'; // ^0.294.0
import { cn } from '../../lib/utils';
import Loading from './Loading';

// Type definitions for enhanced type safety
export type SortDirection = 'asc' | 'desc';
export type CellAlignment = 'left' | 'center' | 'right';
export type FilterType = 'string' | 'number' | 'date' | 'custom';

export interface TableColumn<T = any> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: CellAlignment;
  hidden?: boolean;
  resizable?: boolean;
  filterType?: FilterType;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  isLoading?: boolean;
  className?: string;
  onSort?: (column: string, direction: SortDirection) => void;
  sortColumn?: string;
  sortDirection?: SortDirection;
  ariaLabel?: string;
  stickyHeader?: boolean;
  virtualScroll?: boolean;
  rowSelection?: boolean;
  onRowSelect?: (selectedRows: T[]) => void;
}

/**
 * A reusable table component that provides enterprise-grade features including
 * sorting, responsive design, and accessibility compliance.
 */
const Table = React.memo(<T extends Record<string, any>>({
  data,
  columns,
  isLoading = false,
  className,
  onSort,
  sortColumn,
  sortDirection,
  ariaLabel = 'Data table',
  stickyHeader = false,
  virtualScroll = false,
  rowSelection = false,
  onRowSelect
}: TableProps<T>): JSX.Element => {
  // State for selected rows when row selection is enabled
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());
  
  // Ref for virtualization container
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Handle sort click with keyboard support
  const handleSort = React.useCallback((columnKey: string, event: React.MouseEvent | React.KeyboardEvent) => {
    if (event.type === 'keydown' && (event as React.KeyboardEvent).key !== 'Enter') {
      return;
    }
    
    if (onSort && columns.find(col => col.key === columnKey)?.sortable) {
      const newDirection: SortDirection = 
        columnKey === sortColumn
          ? sortDirection === 'asc' ? 'desc' : 'asc'
          : 'asc';
      
      onSort(columnKey, newDirection);
      
      // Announce sort change for screen readers
      const announcer = document.createElement('div');
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.className = 'sr-only';
      announcer.textContent = `Table sorted by ${columnKey} in ${newDirection}ending order`;
      document.body.appendChild(announcer);
      setTimeout(() => announcer.remove(), 1000);
    }
  }, [onSort, sortColumn, sortDirection, columns]);

  // Handle row selection
  const handleRowSelect = React.useCallback((rowId: string) => {
    if (!rowSelection || !onRowSelect) return;

    setSelectedRows(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(rowId)) {
        newSelected.delete(rowId);
      } else {
        newSelected.add(rowId);
      }
      
      const selectedData = data.filter(row => newSelected.has(row.id));
      onRowSelect(selectedData);
      return newSelected;
    });
  }, [data, rowSelection, onRowSelect]);

  // Render table header
  const renderHeader = () => (
    <thead
      className={cn(
        'bg-gray-50 dark:bg-gray-800 transition-colors duration-200',
        stickyHeader && 'sticky top-0 z-10'
      )}
    >
      <tr>
        {rowSelection && (
          <th className="w-8 px-3 py-3">
            <input
              type="checkbox"
              className="rounded border-gray-300 dark:border-gray-600"
              onChange={e => {
                const newSelected = e.target.checked ? new Set(data.map(row => row.id)) : new Set();
                setSelectedRows(newSelected);
                onRowSelect?.(e.target.checked ? data : []);
              }}
              checked={selectedRows.size === data.length && data.length > 0}
              aria-label="Select all rows"
            />
          </th>
        )}
        {columns.filter(col => !col.hidden).map(column => (
          <th
            key={column.key}
            className={cn(
              'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider select-none',
              column.align === 'center' && 'text-center',
              column.align === 'right' && 'text-right'
            )}
            style={{ width: column.width }}
          >
            {column.sortable ? (
              <button
                className={cn(
                  'inline-flex items-center space-x-1 hover:text-gray-700 dark:hover:text-gray-300',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                )}
                onClick={e => handleSort(column.key, e)}
                onKeyDown={e => handleSort(column.key, e)}
                aria-sort={
                  sortColumn === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <span>{column.header}</span>
                <span className="flex flex-col">
                  <ChevronUp
                    className={cn(
                      'h-3 w-3',
                      sortColumn === column.key && sortDirection === 'asc'
                        ? 'text-primary-500'
                        : 'text-gray-400'
                    )}
                  />
                  <ChevronDown
                    className={cn(
                      'h-3 w-3',
                      sortColumn === column.key && sortDirection === 'desc'
                        ? 'text-primary-500'
                        : 'text-gray-400'
                    )}
                  />
                </span>
              </button>
            ) : (
              <span>{column.header}</span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  );

  // Render table body
  const renderBody = () => (
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
      {data.length === 0 ? (
        <tr>
          <td
            colSpan={columns.length + (rowSelection ? 1 : 0)}
            className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
          >
            No data available
          </td>
        </tr>
      ) : (
        data.map((row, rowIndex) => (
          <tr
            key={row.id || rowIndex}
            className={cn(
              'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200',
              selectedRows.has(row.id) && 'bg-primary-50 dark:bg-primary-900/20'
            )}
            onClick={() => handleRowSelect(row.id)}
          >
            {rowSelection && (
              <td className="w-8 px-3 py-4">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600"
                  checked={selectedRows.has(row.id)}
                  onChange={() => handleRowSelect(row.id)}
                  aria-label={`Select row ${rowIndex + 1}`}
                />
              </td>
            )}
            {columns.filter(col => !col.hidden).map(column => (
              <td
                key={column.key}
                className={cn(
                  'px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right'
                )}
              >
                {column.render
                  ? column.render(row[column.key], row)
                  : row[column.key]}
              </td>
            ))}
          </tr>
        ))
      )}
    </tbody>
  );

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-x-auto', className)}
      role="region"
      aria-label={ariaLabel}
    >
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {renderHeader()}
        {renderBody()}
      </table>
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
          <Loading size="lg" text="Loading data..." />
        </div>
      )}
    </div>
  );
});

// Display name for debugging
Table.displayName = 'Table';

export default Table;