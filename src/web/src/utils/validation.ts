import { z } from 'zod'; // v3.22.0
import { BackgroundCheckType } from '../types/background-check.types';
import { DocumentType } from '../types/document.types';

// Global constants for validation rules
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_VALIDATION_ATTEMPTS = 5;

// Types for validation results
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  details?: Record<string, unknown>;
}

interface FileValidationResult extends ValidationResult {
  securityFlags?: string[];
}

interface PasswordValidationResult extends ValidationResult {
  strength: 'weak' | 'medium' | 'strong';
}

// Email validation schema
const emailSchema = z.string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .regex(EMAIL_REGEX, 'Email format is invalid')
  .transform(email => email.toLowerCase());

/**
 * Validates email format with comprehensive error handling
 * @param email - Email address to validate
 * @returns Validation result with detailed error messages
 */
export const validateEmail = (email: string): ValidationResult => {
  try {
    emailSchema.parse(email);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message),
        details: { zodError: error.flatten() }
      };
    }
    return { isValid: false, errors: ['Email validation failed'] };
  }
};

// Password validation schema
const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(PASSWORD_REGEX, 'Password must contain uppercase, lowercase, number, and special character');

/**
 * Validates password strength and security requirements
 * @param password - Password to validate
 * @returns Validation result with strength assessment
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  try {
    passwordSchema.parse(password);
    
    // Calculate password strength
    const strength = calculatePasswordStrength(password);
    
    return {
      isValid: true,
      errors: [],
      strength
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message),
        strength: 'weak'
      };
    }
    return { isValid: false, errors: ['Password validation failed'], strength: 'weak' };
  }
};

/**
 * Validates file upload with security checks
 * @param file - File object to validate
 * @returns Promise resolving to validation result with security flags
 */
export const validateFileUpload = async (file: File): Promise<FileValidationResult> => {
  const errors: string[] = [];
  const securityFlags: string[] = [];

  // Size validation
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Type validation
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    errors.push('File type not allowed');
    securityFlags.push('INVALID_FILE_TYPE');
  }

  // Additional security checks
  const securityCheck = await performSecurityCheck(file);
  if (!securityCheck.passed) {
    errors.push(...securityCheck.errors);
    securityFlags.push(...securityCheck.flags);
  }

  return {
    isValid: errors.length === 0,
    errors,
    securityFlags,
    details: { fileType: file.type, fileSize: file.size }
  };
};

// Background check data validation schema
const backgroundCheckSchema = z.object({
  type: z.nativeEnum(BackgroundCheckType),
  candidateId: z.string().uuid(),
  documents: z.array(z.object({
    type: z.nativeEnum(DocumentType),
    file: z.instanceof(File)
  })).min(1, 'At least one document is required')
});

/**
 * Validates background check submission data
 * @param data - Background check data to validate
 * @returns Promise resolving to validation result
 */
export const validateBackgroundCheckData = async (
  data: z.infer<typeof backgroundCheckSchema>
): Promise<ValidationResult> => {
  try {
    backgroundCheckSchema.parse(data);
    
    // Validate each document
    const documentValidations = await Promise.all(
      data.documents.map(doc => validateFileUpload(doc.file))
    );
    
    const documentErrors = documentValidations
      .flatMap(validation => validation.errors);

    return {
      isValid: documentErrors.length === 0,
      errors: documentErrors,
      details: {
        checkType: data.type,
        documentsCount: data.documents.length
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return { isValid: false, errors: ['Background check validation failed'] };
  }
};

// Document upload validation schema
const documentUploadSchema = z.object({
  type: z.nativeEnum(DocumentType),
  file: z.instanceof(File),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Validates document upload request with security checks
 * @param data - Document upload data to validate
 * @returns Promise resolving to validation result
 */
export const validateDocumentUpload = async (
  data: z.infer<typeof documentUploadSchema>
): Promise<FileValidationResult> => {
  try {
    documentUploadSchema.parse(data);
    
    // Perform file validation
    const fileValidation = await validateFileUpload(data.file);
    if (!fileValidation.isValid) {
      return fileValidation;
    }

    // Additional document-specific validation
    const documentCheck = await validateDocumentContent(data);
    if (!documentCheck.passed) {
      return {
        isValid: false,
        errors: documentCheck.errors,
        securityFlags: documentCheck.securityFlags
      };
    }

    return {
      isValid: true,
      errors: [],
      details: {
        documentType: data.type,
        metadata: data.metadata
      }
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message),
        securityFlags: ['VALIDATION_ERROR']
      };
    }
    return { isValid: false, errors: ['Document upload validation failed'], securityFlags: ['SYSTEM_ERROR'] };
  }
};

// Helper functions
const calculatePasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  let score = 0;
  
  // Length check
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Complexity checks
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  
  // Determine strength based on score
  if (score <= 3) return 'weak';
  if (score <= 5) return 'medium';
  return 'strong';
};

const performSecurityCheck = async (file: File): Promise<{
  passed: boolean;
  errors: string[];
  flags: string[];
}> => {
  const errors: string[] = [];
  const flags: string[] = [];

  // Virus scan simulation
  const scanResult = await simulateVirusScan(file);
  if (!scanResult.clean) {
    errors.push('File failed security scan');
    flags.push('SECURITY_SCAN_FAILED');
  }

  // Content type verification
  const contentTypeValid = await verifyContentType(file);
  if (!contentTypeValid) {
    errors.push('File content type mismatch');
    flags.push('CONTENT_TYPE_MISMATCH');
  }

  return {
    passed: errors.length === 0,
    errors,
    flags
  };
};

const validateDocumentContent = async (data: z.infer<typeof documentUploadSchema>): Promise<{
  passed: boolean;
  errors: string[];
  securityFlags: string[];
}> => {
  // Document-specific validation logic would go here
  // This is a placeholder implementation
  return {
    passed: true,
    errors: [],
    securityFlags: []
  };
};

// Simulated security check functions
const simulateVirusScan = async (file: File): Promise<{ clean: boolean }> => {
  // Implement actual virus scanning logic here
  return { clean: true };
};

const verifyContentType = async (file: File): Promise<boolean> => {
  // Implement actual content type verification here
  return true;
};