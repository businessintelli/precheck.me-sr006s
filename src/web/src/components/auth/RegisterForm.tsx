// @package react ^18.0.0
// @package react-hook-form ^7.45.0
// @package @hookform/resolvers/zod ^3.3.0
// @package @mui/material ^5.14.0

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinearProgress } from '@mui/material';
import { z } from 'zod';

import { RegisterCredentials } from '../../types/auth.types';
import { useAuth } from '../../hooks/useAuth';
import Form from '../shared/Form';
import Input from '../shared/Input';
import { validateEmail } from '../../lib/utils';

// Enhanced registration form props with organization context
interface RegisterFormProps {
  organizationId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// Enhanced registration schema with comprehensive validation
const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid email format')
    .refine(validateEmail, 'Email validation failed'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  confirmPassword: z.string(),
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .regex(/^[a-zA-Z\s-']{2,50}$/, 'Invalid characters in first name'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .regex(/^[a-zA-Z\s-']{2,50}$/, 'Invalid characters in last name'),
  organizationId: z.string().uuid('Invalid organization ID')
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Password strength calculation
const calculatePasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 12) strength += 25;
  if (/[A-Z]/.test(password)) strength += 25;
  if (/[a-z]/.test(password)) strength += 25;
  if (/[0-9@$!%*?&]/.test(password)) strength += 25;
  return strength;
};

const RegisterForm: React.FC<RegisterFormProps> = ({
  organizationId,
  onSuccess,
  onError
}) => {
  const { register: registerUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleSubmit = async (data: RegisterCredentials) => {
    try {
      setIsSubmitting(true);
      await registerUser({
        ...data,
        organizationId
      });
      onSuccess?.();
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form
      onSubmit={handleSubmit}
      schema={registerSchema}
      defaultValues={{ organizationId }}
      className="space-y-6 w-full max-w-md mx-auto"
    >
      <div className="space-y-4">
        <Input
          label="First Name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          aria-required="true"
          disabled={isSubmitting}
          variant="outlined"
          size="md"
        />

        <Input
          label="Last Name"
          name="lastName"
          type="text"
          autoComplete="family-name"
          required
          aria-required="true"
          disabled={isSubmitting}
          variant="outlined"
          size="md"
        />

        <Input
          label="Email Address"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-required="true"
          disabled={isSubmitting}
          variant="outlined"
          size="md"
        />

        <div className="space-y-2">
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-required="true"
            disabled={isSubmitting}
            variant="outlined"
            size="md"
            onChange={(e) => setPasswordStrength(calculatePasswordStrength(e.target.value))}
          />
          <div 
            className="h-1 rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
            aria-valuenow={passwordStrength}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-300"
              style={{ width: `${passwordStrength}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Password strength: {passwordStrength === 100 ? 'Strong' : passwordStrength >= 50 ? 'Medium' : 'Weak'}
          </p>
        </div>

        <Input
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-required="true"
          disabled={isSubmitting}
          variant="outlined"
          size="md"
        />

        <input type="hidden" name="organizationId" value={organizationId} />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <span className="sr-only">Registering...</span>
            <LinearProgress className="w-full" />
          </>
        ) : (
          'Register'
        )}
      </button>
    </Form>
  );
};

export default RegisterForm;