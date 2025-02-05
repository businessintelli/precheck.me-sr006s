// @package react ^18.0.0
// @package zod ^3.22.0
// @package react-hot-toast ^2.4.1
// @package next-i18next ^14.0.0
// @package @precheck/rate-limit ^1.0.0

import React, { useState } from 'react';
import { z } from 'zod';
import { useTranslation } from 'next-i18next';
import toast from 'react-hot-toast';
import { useRateLimit } from '@precheck/rate-limit';
import Form from '../shared/Form';
import Input from '../shared/Input';
import { Button } from '../shared/Button';
import { apiService } from '../../services/api.service';
import { validateEmail } from '../../lib/utils';

// Interface for form data with strict typing
interface ForgotPasswordFormData {
  email: string;
}

// Enhanced validation schema with security patterns
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email('auth:errors.invalid_email')
    .min(5, 'auth:errors.email_too_short')
    .max(254, 'auth:errors.email_too_long')
    .refine(validateEmail, 'auth:errors.invalid_email_format')
});

// Rate limiting configuration for security
const RATE_LIMIT_CONFIG = {
  maxAttempts: 5,
  windowMs: 300000, // 5 minutes
  blockDuration: 900000 // 15 minutes
};

/**
 * ForgotPasswordForm component with enhanced security and accessibility
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
const ForgotPasswordForm: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const { checkRateLimit, incrementAttempts } = useRateLimit(RATE_LIMIT_CONFIG);

  // Handle form submission with rate limiting and security checks
  const handleSubmit = async (data: ForgotPasswordFormData) => {
    try {
      // Check rate limit before processing
      const canProceed = await checkRateLimit(data.email);
      if (!canProceed) {
        toast.error(t('auth:errors.too_many_attempts'), {
          duration: 5000,
          ariaProps: {
            role: 'alert',
            'aria-live': 'assertive'
          }
        });
        return;
      }

      setIsLoading(true);

      // Make API request with security headers
      await apiService.post('/auth/forgot-password', {
        email: data.email.toLowerCase().trim()
      }, {
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
          'X-Request-Origin': 'forgot-password-form'
        }
      });

      // Show success message with accessibility support
      toast.success(t('auth:messages.reset_link_sent'), {
        duration: 5000,
        ariaProps: {
          role: 'status',
          'aria-live': 'polite'
        }
      });

      // Track attempt for rate limiting
      await incrementAttempts(data.email);

    } catch (error) {
      // Handle specific error cases with user-friendly messages
      const errorMessage = error.response?.status === 429
        ? t('auth:errors.too_many_attempts')
        : t('auth:errors.reset_link_failed');

      toast.error(errorMessage, {
        duration: 5000,
        ariaProps: {
          role: 'alert',
          'aria-live': 'assertive'
        }
      });

    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('auth:forgot_password.title')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('auth:forgot_password.description')}
        </p>
      </div>

      <Form
        onSubmit={handleSubmit}
        schema={forgotPasswordSchema}
        className="space-y-4"
      >
        <Input
          type="email"
          name="email"
          label={t('auth:fields.email')}
          placeholder={t('auth:placeholders.email')}
          autoComplete="email"
          required
          disabled={isLoading}
          aria-describedby="email-description"
          className="w-full"
        />
        
        <div id="email-description" className="text-sm text-gray-500">
          {t('auth:forgot_password.email_help')}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          className="w-full"
          disabled={isLoading}
        >
          {t('auth:buttons.reset_password')}
        </Button>
      </Form>

      {/* Accessibility announcement for loading state */}
      {isLoading && (
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          {t('auth:messages.processing')}
        </div>
      )}
    </div>
  );
};

export default ForgotPasswordForm;