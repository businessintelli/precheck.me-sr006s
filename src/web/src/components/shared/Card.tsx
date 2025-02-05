import React from 'react'; // ^18.0.0
import { cn } from '../../lib/utils';

/**
 * Props interface for the Card component with comprehensive styling and behavior options
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  role?: string;
  'aria-label'?: string;
}

/**
 * Style variants following Material Design 3.0 elevation and color principles
 */
const CARD_VARIANTS = {
  default: 'bg-white dark:bg-gray-800 rounded-lg will-change-transform',
  bordered: 'border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800',
  elevated: 'shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg bg-white dark:bg-gray-800'
} as const;

/**
 * Responsive padding variants following Material Design spacing guidelines
 */
const PADDING_VARIANTS = {
  none: 'p-0',
  sm: 'p-2 sm:p-3',
  md: 'p-3 sm:p-4',
  lg: 'p-4 sm:p-6'
} as const;

/**
 * A reusable card component implementing Material Design 3.0 principles
 * with responsive behavior, dark mode support, and accessibility features.
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  children,
  className,
  variant = 'default',
  padding = 'md',
  onClick,
  role = 'region',
  'aria-label': ariaLabel,
  ...props
}, ref) => {
  // Combine classes with proper precedence using the cn utility
  const cardClasses = cn(
    // Base styles with GPU acceleration hint
    'relative contain-content',
    // Apply variant-specific styles
    CARD_VARIANTS[variant],
    // Apply responsive padding
    PADDING_VARIANTS[padding],
    // Add interactive styles when onClick is provided
    onClick && 'cursor-pointer hover:brightness-98 active:brightness-95 transition-all',
    // Allow custom classes to override defaults
    className
  );

  return (
    <div
      ref={ref}
      className={cardClasses}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
      {...props}
    >
      {children}
    </div>
  );
});

// Set display name for debugging and dev tools
Card.displayName = 'Card';

export default Card;