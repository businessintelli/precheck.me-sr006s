import React from 'react'; // ^18.0.0
import { cn } from '../../lib/utils';

interface LoadingProps {
  /**
   * Size variant of the loading spinner
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
  
  /**
   * Optional text to display below the spinner
   */
  text?: string;
  
  /**
   * Accessible label for screen readers
   * @default 'Loading'
   */
  ariaLabel?: string;
}

/**
 * A reusable loading spinner component that follows Material Design 3.0 principles
 * and provides visual feedback during asynchronous operations.
 * 
 * @example
 * <Loading size="md" text="Please wait..." />
 */
const Loading = React.memo(({
  size = 'md',
  className,
  text,
  ariaLabel = 'Loading'
}: LoadingProps): JSX.Element => {
  // Size-based dimensions mapping
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  // Container size classes for proper spacing
  const containerSizeClasses = {
    sm: 'h-8',
    md: 'h-16',
    lg: 'h-24'
  };

  // Text size classes for visual hierarchy
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        containerSizeClasses[size],
        className
      )}
      role="status"
      aria-label={ariaLabel}
      // Optimize rendering performance
      style={{ contain: 'content' }}
    >
      <div
        className={cn(
          // Base spinner styles
          'rounded-full border-solid animate-spin',
          // Theme-aware colors with proper contrast
          'border-primary/30 border-t-primary',
          // Hardware acceleration for smooth animation
          'will-change-transform',
          // Size-specific classes
          sizeClasses[size]
        )}
        // Support reduced motion preferences
        style={{
          animationDuration: '0.6s',
          '@media (prefers-reduced-motion: reduce)': {
            animationDuration: '1.2s'
          }
        }}
        // Accessibility attributes
        aria-hidden="true"
      />
      
      {text && (
        <p
          className={cn(
            // Text styling with proper contrast
            'mt-2 text-muted-foreground font-medium',
            // Responsive text size
            textSizeClasses[size]
          )}
          // Ensure text is announced after spinner
          aria-live="polite"
        >
          {text}
        </p>
      )}
      
      {/* Visually hidden text for screen readers */}
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
});

// Display name for debugging
Loading.displayName = 'Loading';

export default Loading;