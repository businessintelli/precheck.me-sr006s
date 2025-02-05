// @package clsx ^2.0.0
// @package tailwind-merge ^3.0.0
// @package zod ^3.22.0

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { z } from 'zod';
import { BackgroundCheckStatus } from '../types/background-check.types';
import { VALIDATION_CONSTANTS } from '../types/user.types';

/**
 * Combines and merges Tailwind CSS classes efficiently, removing conflicts
 * while maintaining specificity and proper cascade order
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Status formatting configuration with accessibility and i18n support
 */
const STATUS_CONFIG = {
  [BackgroundCheckStatus.INITIATED]: {
    colors: {
      text: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20'
    },
    i18n: {
      'en-US': 'Initiated',
      'en-UK': 'Initiated',
      'hi-IN': 'आरंभ किया गया'
    }
  },
  [BackgroundCheckStatus.COMPLETED]: {
    colors: {
      text: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20'
    },
    i18n: {
      'en-US': 'Completed',
      'en-UK': 'Completed',
      'hi-IN': 'पूर्ण'
    }
  }
  // Add other status configurations similarly
} as const;

/**
 * Formats background check status into human-readable text with appropriate
 * styling and accessibility attributes
 */
export function formatStatus(status: BackgroundCheckStatus, locale: string = 'en-US') {
  const config = STATUS_CONFIG[status] || {
    colors: { text: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20' },
    i18n: { 'en-US': 'Unknown', 'en-UK': 'Unknown', 'hi-IN': 'अज्ञात' }
  };

  return {
    text: config.i18n[locale as keyof typeof config.i18n] || config.i18n['en-US'],
    color: `${config.colors.text} ${config.colors.bg}`,
    ariaLabel: `Status: ${config.i18n[locale as keyof typeof config.i18n] || config.i18n['en-US']}`
  };
}

/**
 * Currency formatting schema with validation
 */
const currencySchema = z.object({
  amount: z.number().min(-999999999.99).max(999999999.99),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Invalid currency code'),
  locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, 'Invalid locale format')
});

/**
 * Formats number values into currency strings with proper formatting
 * and internationalization support
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  try {
    // Validate inputs
    currencySchema.parse({ amount, currency, locale });

    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return formatter.format(amount);
  } catch (error) {
    console.error('Currency formatting error:', error);
    // Fallback to basic formatting
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Email validation schema with enhanced security checks
 */
const emailValidationSchema = z
  .string()
  .email('Invalid email format')
  .regex(VALIDATION_CONSTANTS.EMAIL_REGEX, 'Invalid email format')
  .min(5, 'Email too short')
  .max(254, 'Email too long')
  .refine(
    (email) => {
      // Additional security checks
      const restrictedPatterns = [
        /@(admin|root|system)\./i,
        /[<>'"()%]/, // Common injection characters
        /\.{2,}/, // Multiple consecutive dots
        /^[.-]|[.-]@|@[.-]|[.-]$/ // Invalid dot/hyphen placement
      ];
      return !restrictedPatterns.some(pattern => pattern.test(email));
    },
    { message: 'Email contains invalid or restricted patterns' }
  );

/**
 * Validates email format using secure regex pattern with comprehensive checks
 */
export function validateEmail(email: string): boolean {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    emailValidationSchema.parse(normalizedEmail);
    
    // Additional validation for domain
    const [, domain] = normalizedEmail.split('@');
    if (!domain || domain.length > 255 || !domain.includes('.')) {
      return false;
    }

    return true;
  } catch (error) {
    console.debug('Email validation failed:', error);
    return false;
  }
}