import { format, isValid, parseISO, differenceInDays, addDays } from 'date-fns'; // v2.30.0

/**
 * Standardized date format patterns with semantic naming
 */
export const DATE_FORMATS = {
  DISPLAY_DATE: 'MMM dd, yyyy',
  DISPLAY_DATETIME: 'MMM dd, yyyy HH:mm',
  ISO_DATE: 'yyyy-MM-dd',
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  SHORT_DATE: 'MM/dd/yyyy',
  SHORT_TIME: 'HH:mm',
  RELATIVE_TIME_THRESHOLD: 7
} as const;

/**
 * Type definitions for function parameters
 */
type DateInput = Date | string | number | null | undefined;
type DateFormatOptions = {
  threshold?: number;
  locale?: Locale;
};
type BusinessDayOptions = {
  includeEndDate?: boolean;
  businessDaysOnly?: boolean;
  holidays?: Date[];
};
type TimezoneOptions = {
  holidays?: Date[];
  timezone?: string;
};

/**
 * Formats a date into a standardized string representation with locale support
 * @param date - Input date (Date object, ISO string, timestamp)
 * @param formatString - Optional format pattern (defaults to DISPLAY_DATE)
 * @param locale - Optional locale for internationalization
 * @returns Formatted date string or null if input is invalid
 */
export const formatDate = (
  date: DateInput,
  formatString?: string,
  locale?: Locale
): string | null => {
  try {
    if (!date) return null;

    const parsedDate = typeof date === 'string' ? parseISO(date) : 
                      typeof date === 'number' ? new Date(date) : date;

    if (!isValidDate(parsedDate)) return null;

    return format(parsedDate, formatString || DATE_FORMATS.DISPLAY_DATE, { locale });
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
};

/**
 * Formats a date relative to current time with configurable thresholds
 * @param date - Input date to format
 * @param options - Configuration options for threshold and locale
 * @returns Relative time string or null if input is invalid
 */
export const formatRelativeTime = (
  date: DateInput,
  options: DateFormatOptions = {}
): string | null => {
  try {
    if (!date) return null;

    const parsedDate = typeof date === 'string' ? parseISO(date) :
                      typeof date === 'number' ? new Date(date) : date;

    if (!isValidDate(parsedDate)) return null;

    const now = new Date();
    const diffDays = differenceInDays(parsedDate, now);
    const threshold = options.threshold ?? DATE_FORMATS.RELATIVE_TIME_THRESHOLD;

    if (Math.abs(diffDays) <= threshold) {
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      return `${Math.abs(diffDays)} days ${diffDays > 0 ? 'from now' : 'ago'}`;
    }

    return formatDate(parsedDate, DATE_FORMATS.DISPLAY_DATE, options.locale);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return null;
  }
};

/**
 * Type-safe date validation with comprehensive error checking
 * @param value - Value to validate as a date
 * @returns Boolean indicating if the value is a valid date
 */
export const isValidDate = (value: unknown): boolean => {
  if (!value) return false;

  if (value instanceof Date) {
    return isValid(value);
  }

  if (typeof value === 'string') {
    const parsed = parseISO(value);
    return isValid(parsed);
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return isValid(parsed);
  }

  return false;
};

/**
 * Calculates the difference in days between dates with business day support
 * @param startDate - Start date for calculation
 * @param endDate - End date for calculation
 * @param options - Configuration options for calculation
 * @returns Number of days between dates or null if invalid input
 */
export const calculateDateDifference = (
  startDate: DateInput,
  endDate: DateInput,
  options: BusinessDayOptions = {}
): number | null => {
  try {
    if (!startDate || !endDate) return null;

    const start = typeof startDate === 'string' ? parseISO(startDate) :
                 typeof startDate === 'number' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) :
               typeof endDate === 'number' ? new Date(endDate) : endDate;

    if (!isValidDate(start) || !isValidDate(end)) return null;

    let difference = differenceInDays(end, start);
    if (options.includeEndDate) difference += 1;

    if (options.businessDaysOnly) {
      let businessDays = 0;
      let currentDate = start;

      while (differenceInDays(end, currentDate) >= 0) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = options.holidays?.some(
          holiday => differenceInDays(holiday, currentDate) === 0
        );

        if (!isWeekend && !isHoliday) {
          businessDays++;
        }

        currentDate = addDays(currentDate, 1);
      }

      return businessDays;
    }

    return difference;
  } catch (error) {
    console.error('Error calculating date difference:', error);
    return null;
  }
};

/**
 * Adds business days to a date with holiday awareness
 * @param date - Starting date
 * @param days - Number of business days to add
 * @param options - Configuration options including holidays and timezone
 * @returns Resulting date or null if invalid input
 */
export const addBusinessDays = (
  date: DateInput,
  days: number,
  options: TimezoneOptions = {}
): Date | null => {
  try {
    if (!date || typeof days !== 'number') return null;

    const startDate = typeof date === 'string' ? parseISO(date) :
                     typeof date === 'number' ? new Date(date) : date;

    if (!isValidDate(startDate)) return null;

    let remainingDays = days;
    let currentDate = startDate;

    while (remainingDays > 0) {
      currentDate = addDays(currentDate, 1);
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = options.holidays?.some(
        holiday => differenceInDays(holiday, currentDate) === 0
      );

      if (!isWeekend && !isHoliday) {
        remainingDays--;
      }
    }

    // Handle timezone if specified
    if (options.timezone) {
      const tzOffset = new Date().getTimezoneOffset();
      currentDate = new Date(currentDate.getTime() + tzOffset * 60 * 1000);
    }

    return currentDate;
  } catch (error) {
    console.error('Error adding business days:', error);
    return null;
  }
};