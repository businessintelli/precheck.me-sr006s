'use client';

import React from 'react'; // ^18.0.0
import { cn } from '../lib/utils';
import Loading from '../components/shared/Loading';

/**
 * Enhanced global loading component for Next.js 14 app router that provides
 * a consistent loading state UI across the application during page transitions
 * and data fetching operations.
 * 
 * Features:
 * - Material Design 3.0 principles with clear visual hierarchy
 * - System-aware dark/light theme support
 * - WCAG 2.1 Level AA compliance
 * - Smooth transitions and animations
 * - Responsive layout
 */
export default function LoadingPage(): JSX.Element {
  return (
    <div
      className={cn(
        // Base layout styles
        'fixed inset-0 flex items-center justify-center',
        // Theme-aware background with proper contrast
        'bg-background/80 backdrop-blur-sm',
        // Text color for proper contrast
        'text-foreground',
        // Smooth theme transitions
        'transition-colors duration-300',
        // Proper z-index for overlay
        'z-50'
      )}
      // Performance optimizations
      style={{
        contain: 'strict',
        willChange: 'backdrop-filter'
      }}
      // Accessibility attributes
      role="alert"
      aria-live="polite"
      aria-busy="true"
      aria-label="Page is loading"
    >
      <div
        className={cn(
          // Container styles for proper spacing
          'flex flex-col items-center justify-center',
          // Responsive padding
          'p-4 sm:p-6 md:p-8',
          // Max width for larger screens
          'max-w-md w-full',
          // Theme-aware container background
          'bg-background/40 rounded-lg',
          // Subtle shadow for depth
          'shadow-lg'
        )}
      >
        <Loading 
          // Large size for global loading state
          size="lg"
          // Informative loading message
          text="Loading page content..."
          // Additional styling for global context
          className="my-4"
          // Explicit aria label for screen readers
          ariaLabel="Loading page content, please wait"
        />

        {/* Fallback text for no-script environments */}
        <noscript>
          <p className="text-center text-muted-foreground">
            Please enable JavaScript to view this page.
          </p>
        </noscript>
      </div>
    </div>
  );
}