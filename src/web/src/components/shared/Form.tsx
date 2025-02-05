// @package react ^18.0.0
// @package react-hook-form ^7.45.0
// @package @hookform/resolvers/zod ^3.3.0
// @package class-variance-authority ^0.7.0

import React from 'react';
import { FormProvider, useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '../../lib/utils';
import Input from './Input';

// Form component props with generic type support
export interface FormProps<T extends Record<string, any>> {
  children: React.ReactNode | ((methods: UseFormReturn<T>) => React.ReactNode);
  onSubmit: (data: T, methods: UseFormReturn<T>) => Promise<void> | void;
  schema: z.ZodSchema<T>;
  defaultValues?: Partial<T>;
  className?: string;
}

// Material Design compliant form styles using class-variance-authority
const getFormStyles = (className?: string, hasError?: boolean) => {
  return cn(
    // Base Material Design layout
    'flex flex-col space-y-4 w-full max-w-md mx-auto',
    // Error state styles
    hasError && 'animate-shake',
    // Custom classes
    className
  );
};

// Custom hook for form state management with enhanced validation
const useFormWithValidation = <T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  defaultValues?: Partial<T>
): UseFormReturn<T> => {
  return useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
    criteriaMode: 'all',
    shouldFocusError: true
  });
};

/**
 * A reusable form component implementing Material Design 3.0 principles
 * with built-in validation, error handling, and accessibility features.
 */
const Form = <T extends Record<string, any>>({
  children,
  onSubmit,
  schema,
  defaultValues,
  className
}: FormProps<T>): JSX.Element => {
  // Initialize form with validation
  const methods = useFormWithValidation<T>(schema, defaultValues);
  const { handleSubmit, formState: { errors, isSubmitting } } = methods;

  // Handle form submission with error boundary
  const handleFormSubmit = async (data: T) => {
    try {
      await onSubmit(data, methods);
    } catch (error) {
      console.error('Form submission error:', error);
      // Re-throw to be caught by error boundary
      throw error;
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className={getFormStyles(className, Object.keys(errors).length > 0)}
        noValidate // Use custom validation
        aria-label="Form"
      >
        {/* Support both render prop and direct children */}
        {typeof children === 'function' ? children(methods) : children}

        {/* Accessibility announcement for form errors */}
        {Object.keys(errors).length > 0 && (
          <div
            className="sr-only"
            role="alert"
            aria-live="polite"
          >
            Form contains errors. Please check your inputs.
          </div>
        )}

        {/* Loading state announcement */}
        {isSubmitting && (
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
          >
            Submitting form...
          </div>
        )}
      </form>
    </FormProvider>
  );
};

// Type assertion for better type inference
Form.displayName = 'Form';

export default Form as <T extends Record<string, any>>(
  props: FormProps<T>
) => JSX.Element;

// Export form field components for convenience
export { Input };

// Export type utilities
export type { UseFormReturn };