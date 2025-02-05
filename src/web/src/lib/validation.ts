import { z } from 'zod'; // v3.22.0
import { BackgroundCheckType } from '../types/background-check.types';
import { DocumentType } from '../types/document.types';
import { InterviewType } from '../types/interview.types';
import { VALIDATION_CONSTANTS, emailSchema, passwordSchema, phoneSchema } from '../types/user.types';

// Global validation constants
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MIN_INTERVIEW_DURATION = 30;
const MAX_INTERVIEW_DURATION = 120;

/**
 * Enhanced validation schema for login credentials with MFA support
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  mfaCode: z.string()
    .length(6, 'MFA code must be 6 digits')
    .regex(/^\d+$/, 'MFA code must contain only numbers')
    .optional(),
}).strict();

/**
 * Enhanced validation schema for user registration with security features
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name is too long')
    .regex(/^[a-zA-Z\s-']+$/, 'First name contains invalid characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name is too long')
    .regex(/^[a-zA-Z\s-']+$/, 'Last name contains invalid characters'),
  organizationId: z.string().uuid('Invalid organization ID'),
  phoneNumber: phoneSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).strict();

/**
 * Enhanced validation schema for background check creation with consent tracking
 */
export const backgroundCheckSchema = z.object({
  type: z.nativeEnum(BackgroundCheckType, {
    errorMap: () => ({ message: 'Invalid background check type' })
  }),
  candidateId: z.string().uuid('Invalid candidate ID'),
  organizationId: z.string().uuid('Invalid organization ID'),
  consentObtained: z.boolean()
    .refine((val) => val === true, {
      message: 'Candidate consent is required'
    }),
}).strict();

/**
 * Enhanced validation schema for document uploads with security features
 */
export const documentUploadSchema = z.object({
  type: z.nativeEnum(DocumentType, {
    errorMap: () => ({ message: 'Invalid document type' })
  }),
  checkId: z.string().uuid('Invalid check ID'),
  file: z.object({
    size: z.number()
      .max(MAX_FILE_SIZE, 'File size exceeds maximum limit'),
    name: z.string()
      .min(1, 'Filename is required')
      .max(255, 'Filename is too long')
      .regex(/^[a-zA-Z0-9-_\s.]+$/, 'Filename contains invalid characters'),
  }),
  mimeType: z.string()
    .refine((val) => ALLOWED_MIME_TYPES.includes(val), {
      message: 'Invalid file type'
    }),
  hash: z.string()
    .min(32, 'Invalid file hash')
    .max(128, 'Invalid file hash'),
}).strict();

/**
 * Enhanced validation schema for interview scheduling with timezone support
 */
export const interviewScheduleSchema = z.object({
  type: z.nativeEnum(InterviewType, {
    errorMap: () => ({ message: 'Invalid interview type' })
  }),
  backgroundCheckId: z.string().uuid('Invalid background check ID'),
  candidateId: z.string().uuid('Invalid candidate ID'),
  scheduledAt: z.date()
    .refine((date) => date > new Date(), {
      message: 'Interview must be scheduled in the future'
    }),
  duration: z.number()
    .min(MIN_INTERVIEW_DURATION, `Interview duration must be at least ${MIN_INTERVIEW_DURATION} minutes`)
    .max(MAX_INTERVIEW_DURATION, `Interview duration cannot exceed ${MAX_INTERVIEW_DURATION} minutes`),
  timeZone: z.string()
    .regex(/^[A-Za-z_\/]+\/[A-Za-z_]+$/, 'Invalid timezone format'),
}).strict();

/**
 * Enhanced validation for login credentials with MFA and security checks
 */
export async function validateLoginCredentials(data: unknown): Promise<z.SafeParseReturnType<any, any>> {
  // Sanitize input data to prevent XSS
  const sanitizedData = typeof data === 'object' ? 
    JSON.parse(JSON.stringify(data).replace(/[<>]/g, '')) : 
    data;

  return loginSchema.safeParseAsync(sanitizedData);
}

/**
 * Enhanced validation for user registration with security features
 */
export async function validateRegistration(data: unknown): Promise<z.SafeParseReturnType<any, any>> {
  // Sanitize all input fields
  const sanitizedData = typeof data === 'object' ? 
    JSON.parse(JSON.stringify(data).replace(/[<>]/g, '')) : 
    data;

  return registerSchema.safeParseAsync(sanitizedData);
}