import { format as dateFormat } from 'date-fns'; // v2.30.0
import { BackgroundCheckStatus } from '../types/background-check.types';
import { DocumentType, DocumentStatus } from '../types/document.types';

/**
 * CSS classes for different status types with semantic color mapping
 * Supports both light and dark mode with appropriate contrast
 */
export const STATUS_CLASSES = {
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-gray-600 dark:text-gray-400'
} as const;

/**
 * Enhanced confidence score thresholds with semantic styling
 * Includes accessibility labels and appropriate icons
 */
export const CONFIDENCE_LEVELS = {
  high: {
    threshold: 0.9,
    class: 'text-green-600 dark:text-green-400',
    icon: 'CheckCircle',
    ariaLabel: 'High Confidence'
  },
  medium: {
    threshold: 0.7,
    class: 'text-yellow-600 dark:text-yellow-400',
    icon: 'AlertCircle',
    ariaLabel: 'Medium Confidence'
  },
  low: {
    threshold: 0,
    class: 'text-red-600 dark:text-red-400',
    icon: 'XCircle',
    ariaLabel: 'Low Confidence'
  }
} as const;

interface CurrencyFormatOptions {
  decimals?: number;
  symbol?: string;
  groupSeparator?: string;
  decimalSeparator?: string;
}

/**
 * Formats a number as currency with configurable locale and formatting options
 * @param amount - The number to format as currency
 * @param locale - The locale to use for formatting (defaults to 'en-US')
 * @param options - Additional formatting options
 * @returns Formatted currency string with locale-specific formatting
 */
export function formatCurrency(
  amount: number | null | undefined,
  locale: string = 'en-US',
  options: CurrencyFormatOptions = {}
): string {
  if (amount == null) return '-';
  
  const {
    decimals = 2,
    symbol = '$',
    groupSeparator = ',',
    decimalSeparator = '.'
  } = options;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  } catch (error) {
    // Fallback formatting if Intl is not available
    const parts = Math.abs(amount)
      .toFixed(decimals)
      .split('.');
    
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
    
    return `${amount < 0 ? '-' : ''}${symbol}${parts.join(decimalSeparator)}`;
  }
}

interface DocumentStatusFormatOptions {
  uppercase?: boolean;
  showIcon?: boolean;
  customClasses?: string;
}

/**
 * Formats document status with enhanced styling and accessibility features
 * @param status - The document status to format
 * @param includeClass - Whether to include CSS classes in the output
 * @param options - Additional formatting options
 * @returns Formatted object with display properties
 */
export function formatDocumentStatus(
  status: DocumentStatus,
  includeClass: boolean = true,
  options: DocumentStatusFormatOptions = {}
): { label: string; class: string; icon: string; ariaLabel: string } {
  const { uppercase = true, showIcon = true, customClasses = '' } = options;

  const statusConfig = {
    [DocumentStatus.PENDING]: {
      label: 'Pending',
      class: STATUS_CLASSES.neutral,
      icon: 'Clock',
      ariaLabel: 'Document pending verification'
    },
    [DocumentStatus.PROCESSING]: {
      label: 'Processing',
      class: STATUS_CLASSES.info,
      icon: 'Loader',
      ariaLabel: 'Document verification in progress'
    },
    [DocumentStatus.VERIFIED]: {
      label: 'Verified',
      class: STATUS_CLASSES.success,
      icon: 'CheckCircle',
      ariaLabel: 'Document successfully verified'
    },
    [DocumentStatus.REJECTED]: {
      label: 'Rejected',
      class: STATUS_CLASSES.error,
      icon: 'XCircle',
      ariaLabel: 'Document verification failed'
    },
    [DocumentStatus.ERROR]: {
      label: 'Error',
      class: STATUS_CLASSES.error,
      icon: 'AlertTriangle',
      ariaLabel: 'Error during document verification'
    },
    [DocumentStatus.REQUIRES_MANUAL_REVIEW]: {
      label: 'Manual Review',
      class: STATUS_CLASSES.warning,
      icon: 'Eye',
      ariaLabel: 'Document requires manual review'
    },
    [DocumentStatus.EXPIRED]: {
      label: 'Expired',
      class: STATUS_CLASSES.error,
      icon: 'Calendar',
      ariaLabel: 'Document has expired'
    }
  };

  const config = statusConfig[status];
  const label = uppercase ? config.label.toUpperCase() : config.label;
  const className = includeClass ? `${config.class} ${customClasses}`.trim() : '';

  return {
    label,
    class: className,
    icon: showIcon ? config.icon : '',
    ariaLabel: config.ariaLabel
  };
}

interface VerificationThresholds {
  high?: number;
  medium?: number;
  low?: number;
}

/**
 * Formats verification confidence score with enhanced validation and customization
 * @param score - Confidence score between 0 and 1
 * @param thresholds - Custom threshold values for confidence levels
 * @returns Formatted object with confidence level properties
 */
export function formatVerificationScore(
  score: number | null | undefined,
  thresholds: VerificationThresholds = {}
): { value: string; class: string; level: string; icon: string } {
  if (score == null || isNaN(score) || score < 0 || score > 1) {
    return {
      value: 'N/A',
      class: STATUS_CLASSES.neutral,
      level: 'unknown',
      icon: 'HelpCircle'
    };
  }

  const {
    high = CONFIDENCE_LEVELS.high.threshold,
    medium = CONFIDENCE_LEVELS.medium.threshold,
    low = CONFIDENCE_LEVELS.low.threshold
  } = thresholds;

  let level: keyof typeof CONFIDENCE_LEVELS;
  if (score >= high) {
    level = 'high';
  } else if (score >= medium) {
    level = 'medium';
  } else {
    level = 'low';
  }

  const config = CONFIDENCE_LEVELS[level];
  const percentage = `${Math.round(score * 100)}%`;

  return {
    value: percentage,
    class: config.class,
    level: level,
    icon: config.icon
  };
}

/**
 * Formats document type labels for display
 * @param type - The document type to format
 * @returns Formatted document type label
 */
export function formatDocumentType(type: DocumentType): string {
  return type
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats background check status for display
 * @param status - The background check status to format
 * @returns Formatted status object with display properties
 */
export function formatBackgroundCheckStatus(
  status: BackgroundCheckStatus
): { label: string; class: string; icon: string } {
  const statusConfig = {
    [BackgroundCheckStatus.INITIATED]: {
      label: 'Initiated',
      class: STATUS_CLASSES.info,
      icon: 'Play'
    },
    [BackgroundCheckStatus.DOCUMENTS_PENDING]: {
      label: 'Documents Pending',
      class: STATUS_CLASSES.warning,
      icon: 'FileQuestion'
    },
    [BackgroundCheckStatus.DOCUMENTS_UPLOADED]: {
      label: 'Documents Uploaded',
      class: STATUS_CLASSES.info,
      icon: 'FileCheck'
    },
    [BackgroundCheckStatus.VERIFICATION_IN_PROGRESS]: {
      label: 'Verifying',
      class: STATUS_CLASSES.info,
      icon: 'Loader'
    },
    [BackgroundCheckStatus.INTERVIEW_SCHEDULED]: {
      label: 'Interview Scheduled',
      class: STATUS_CLASSES.info,
      icon: 'Calendar'
    },
    [BackgroundCheckStatus.INTERVIEW_COMPLETED]: {
      label: 'Interview Completed',
      class: STATUS_CLASSES.success,
      icon: 'UserCheck'
    },
    [BackgroundCheckStatus.COMPLETED]: {
      label: 'Completed',
      class: STATUS_CLASSES.success,
      icon: 'CheckCircle'
    },
    [BackgroundCheckStatus.REJECTED]: {
      label: 'Rejected',
      class: STATUS_CLASSES.error,
      icon: 'XCircle'
    },
    [BackgroundCheckStatus.CANCELLED]: {
      label: 'Cancelled',
      class: STATUS_CLASSES.neutral,
      icon: 'XSquare'
    }
  };

  return statusConfig[status];
}