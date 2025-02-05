import React from 'react'; // ^18.0.0
import { clsx } from 'clsx'; // ^2.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { Document, DocumentStatus, DocumentType } from '../../types/document.types';
import Loading from '../shared/Loading';
import { Button } from '../shared/Button';
import { cn } from '../../lib/utils';

// Supported file types for preview
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

// Maximum file size for preview (10MB)
const MAX_PREVIEW_SIZE = 10485760;

// Preview generation timeout (30s)
const PREVIEW_TIMEOUT = 30000;

interface DocumentPreviewProps {
  document: Document;
  onDelete?: (id: string) => Promise<void>;
  onDownload?: (url: string) => Promise<void>;
  className?: string;
  isLoading?: boolean;
  onError?: (error: Error) => void;
  showConfidenceScore?: boolean;
  accessibilityLabel?: string;
}

const getStatusColor = (status: DocumentStatus): string => {
  const statusColors = {
    [DocumentStatus.PENDING]: 'text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
    [DocumentStatus.PROCESSING]: 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
    [DocumentStatus.VERIFIED]: 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
    [DocumentStatus.REJECTED]: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    [DocumentStatus.ERROR]: 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    [DocumentStatus.REQUIRES_MANUAL_REVIEW]: 'text-purple-700 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20',
    [DocumentStatus.EXPIRED]: 'text-gray-700 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20'
  };

  return statusColors[status] || statusColors[DocumentStatus.ERROR];
};

const DocumentPreview: React.FC<DocumentPreviewProps> = React.memo(({
  document,
  onDelete,
  onDownload,
  className,
  isLoading = false,
  onError,
  showConfidenceScore = false,
  accessibilityLabel
}) => {
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(true);
  const previewTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Validate file size and type
  const canPreview = React.useMemo(() => {
    return (
      document.fileSize <= MAX_PREVIEW_SIZE &&
      SUPPORTED_FILE_TYPES.includes(document.mimeType as typeof SUPPORTED_FILE_TYPES[number])
    );
  }, [document.fileSize, document.mimeType]);

  // Handle preview loading timeout
  React.useEffect(() => {
    if (isPreviewLoading) {
      previewTimeoutRef.current = setTimeout(() => {
        setPreviewError('Preview generation timed out');
        setIsPreviewLoading(false);
        onError?.(new Error('Preview timeout'));
      }, PREVIEW_TIMEOUT);
    }

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [isPreviewLoading, onError]);

  // Handle preview load events
  const handlePreviewLoad = React.useCallback(() => {
    setIsPreviewLoading(false);
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
  }, []);

  const handlePreviewError = React.useCallback((error: string) => {
    setPreviewError(error);
    setIsPreviewLoading(false);
    onError?.(new Error(error));
  }, [onError]);

  // Secure document actions
  const handleDelete = React.useCallback(async () => {
    try {
      if (onDelete) {
        await onDelete(document.id);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [document.id, onDelete, onError]);

  const handleDownload = React.useCallback(async () => {
    try {
      if (onDownload) {
        await onDownload(document.url);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [document.url, onDownload, onError]);

  return (
    <ErrorBoundary
      fallback={
        <div className="p-4 text-red-700 bg-red-50 rounded-md">
          Failed to load document preview
        </div>
      }
      onError={onError}
    >
      <div
        className={cn(
          'rounded-lg border border-border p-4 shadow-sm',
          className
        )}
        aria-label={accessibilityLabel || `Document preview for ${document.fileName}`}
      >
        {/* Document Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="font-medium truncate max-w-[200px]">
              {document.fileName}
            </span>
            <span
              className={clsx(
                'px-2 py-1 text-xs font-medium rounded-full',
                getStatusColor(document.status)
              )}
            >
              {document.status}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {onDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isLoading}
                aria-label="Download document"
              >
                Download
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700"
                aria-label="Delete document"
              >
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Preview Area */}
        <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
          {isLoading || isPreviewLoading ? (
            <Loading
              size="lg"
              text="Loading preview..."
              className="absolute inset-0"
            />
          ) : previewError ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {previewError}
            </div>
          ) : canPreview ? (
            document.mimeType.startsWith('image/') ? (
              <img
                src={document.url}
                alt={document.fileName}
                className="w-full h-full object-contain"
                onLoad={handlePreviewLoad}
                onError={() => handlePreviewError('Failed to load image')}
              />
            ) : (
              <iframe
                src={`${document.url}#view=FitH`}
                title={document.fileName}
                className="w-full h-full"
                onLoad={handlePreviewLoad}
                onError={() => handlePreviewError('Failed to load document')}
                sandbox="allow-scripts allow-same-origin"
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              Preview not available
            </div>
          )}
        </div>

        {/* Document Details */}
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="font-medium">{document.type}</span>
          </div>
          <div className="flex justify-between">
            <span>Size:</span>
            <span className="font-medium">
              {(document.fileSize / 1024).toFixed(2)} KB
            </span>
          </div>
          <div className="flex justify-between">
            <span>Uploaded:</span>
            <span className="font-medium">
              {new Date(document.uploadedAt).toLocaleDateString()}
            </span>
          </div>
          {showConfidenceScore && document.verificationResult && (
            <div className="flex justify-between">
              <span>Verification Confidence:</span>
              <span className="font-medium">
                {document.verificationResult.confidenceScore}%
              </span>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
});

DocumentPreview.displayName = 'DocumentPreview';

export default DocumentPreview;