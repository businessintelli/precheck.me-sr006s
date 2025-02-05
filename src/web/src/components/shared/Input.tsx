// @package react ^18.0.0
// @package class-variance-authority ^0.7.0

import React, { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Input variants following Material Design 3.0 principles
const inputVariants = cva(
  // Base styles with Material Design foundations
  'w-full transition-all duration-200 font-normal leading-tight relative',
  {
    variants: {
      variant: {
        default: 'bg-white border border-gray-300 rounded-md shadow-sm',
        filled: 'bg-gray-100 border-b-2 border-gray-300 rounded-t-md',
        outlined: 'bg-transparent border-2 border-gray-300 rounded-md'
      },
      size: {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg'
      },
      state: {
        normal: '',
        error: 'border-red-500 focus:border-red-500',
        disabled: 'opacity-60 cursor-not-allowed bg-gray-50'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      state: 'normal'
    }
  }
);

// Label variants for consistent styling
const labelVariants = cva(
  'block font-medium transition-colors duration-200 mb-1',
  {
    variants: {
      size: {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg'
      },
      state: {
        normal: 'text-gray-700',
        error: 'text-red-500',
        disabled: 'text-gray-400'
      }
    },
    defaultVariants: {
      size: 'md',
      state: 'normal'
    }
  }
);

// Helper text variants
const helperTextVariants = cva(
  'text-xs mt-1 transition-colors duration-200',
  {
    variants: {
      state: {
        normal: 'text-gray-500',
        error: 'text-red-500',
        disabled: 'text-gray-400'
      }
    },
    defaultVariants: {
      state: 'normal'
    }
  }
);

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
  variant?: 'default' | 'filled' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
  required?: boolean;
  disabled?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      error,
      label,
      helperText,
      variant = 'default',
      size = 'md',
      required = false,
      disabled = false,
      id,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    // Generate unique IDs for accessibility
    const inputId = id || `input-${Math.random().toString(36).slice(2, 11)}`;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    // Determine input state for styling
    const state = disabled ? 'disabled' : error ? 'error' : 'normal';

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              labelVariants({ size, state }),
              required && 'after:content-["*"] after:ml-0.5 after:text-red-500'
            )}
          >
            {label}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={cn(
            inputVariants({ variant, size, state }),
            // Focus states following Material Design
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            variant === 'outlined' 
              ? 'focus:border-primary-500 focus:ring-primary-500/20'
              : 'focus:border-primary-500 focus:ring-primary-500/20',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={cn(
            helperText && helperId,
            error && errorId,
            ariaDescribedBy
          )}
          disabled={disabled}
          required={required}
          {...props}
        />

        {/* Helper or error text with proper ARIA attributes */}
        {(helperText || error) && (
          <div
            id={error ? errorId : helperId}
            className={helperTextVariants({ state })}
            role={error ? 'alert' : 'status'}
          >
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

// Display name for React DevTools
Input.displayName = 'Input';

export default Input;