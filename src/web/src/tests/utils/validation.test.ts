import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.7.0
import { 
  validateEmail, 
  validatePassword,
  validateFileUpload,
} from '../../utils/validation';
import { 
  loginSchema,
  registerSchema,
} from '../../lib/validation';

describe('Email Validation', () => {
  const validEmails = [
    'test@example.com',
    'user.name@domain.co.uk',
    'user+label@domain.com',
    'first.last@subdomain.domain.org',
  ];

  const invalidEmails = [
    'invalid-email',
    '@domain.com',
    'user@',
    'user@.com',
    'user@domain.',
    'user name@domain.com',
    'user@domain..com',
    '<script>@domain.com', // XSS attempt
    'admin@domain.com', // Restricted word
    'user@domain.com;drop table users', // SQL injection attempt
    'a'.repeat(255) + '@domain.com', // Exceeds max length
  ];

  it.each(validEmails)('should validate correct email format: %s', (email) => {
    const result = validateEmail(email);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it.each(invalidEmails)('should reject invalid email format: %s', (email) => {
    const result = validateEmail(email);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should normalize email to lowercase', () => {
    const result = validateEmail('Test.User@Example.COM');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle null and undefined inputs', () => {
    // @ts-expect-error Testing invalid input
    expect(validateEmail(null).isValid).toBe(false);
    // @ts-expect-error Testing invalid input
    expect(validateEmail(undefined).isValid).toBe(false);
  });
});

describe('Password Validation', () => {
  const validPasswords = [
    'Test@12345678',
    'Complex@Password123',
    'Super$ecure123Password',
    'P@ssw0rd!2023',
  ];

  const invalidPasswords = [
    'weak',
    'nospecialchar1',
    'NoNumbers!',
    'no@digits',
    'Short@1',
    '12345678',
    'password123',
    'admin@123', // Common pattern
    'P@ssword123', // Common pattern
    'a'.repeat(129), // Exceeds max length
  ];

  it.each(validPasswords)('should validate strong passwords: %s', (password) => {
    const result = validatePassword(password);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.strength).toBe('strong');
  });

  it.each(invalidPasswords)('should reject weak passwords: %s', (password) => {
    const result = validatePassword(password);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.strength).toBe('weak');
  });

  it('should evaluate password strength correctly', () => {
    const weakResult = validatePassword('Test@123');
    expect(weakResult.strength).toBe('weak');

    const mediumResult = validatePassword('Test@123456');
    expect(mediumResult.strength).toBe('medium');

    const strongResult = validatePassword('Test@12345678!Secure');
    expect(strongResult.strength).toBe('strong');
  });

  it('should reject passwords containing personal information', () => {
    const result = validatePassword('admin@Admin123');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password contains restricted words');
  });
});

describe('File Upload Validation', () => {
  const mockValidPDF = new File([''], 'test.pdf', { type: 'application/pdf' });
  const mockValidImage = new File([''], 'test.jpg', { type: 'image/jpeg' });
  const mockLargeFile = new File([''], 'large.pdf', { type: 'application/pdf' });
  Object.defineProperty(mockLargeFile, 'size', { value: 15 * 1024 * 1024 }); // 15MB

  const mockMaliciousFile = new File([''], 'malicious.exe', { type: 'application/x-msdownload' });
  const mockEmptyFile = new File([''], '', { type: 'application/pdf' });

  it('should validate allowed file types', async () => {
    const pdfResult = await validateFileUpload(mockValidPDF);
    expect(pdfResult.isValid).toBe(true);
    expect(pdfResult.errors).toHaveLength(0);

    const imageResult = await validateFileUpload(mockValidImage);
    expect(imageResult.isValid).toBe(true);
    expect(imageResult.errors).toHaveLength(0);
  });

  it('should reject files exceeding size limit', async () => {
    const result = await validateFileUpload(mockLargeFile);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('File size exceeds maximum allowed size of 10MB');
  });

  it('should reject disallowed file types', async () => {
    const result = await validateFileUpload(mockMaliciousFile);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('File type not allowed');
    expect(result.securityFlags).toContain('INVALID_FILE_TYPE');
  });

  it('should reject empty files', async () => {
    const result = await validateFileUpload(mockEmptyFile);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should include file metadata in validation result', async () => {
    const result = await validateFileUpload(mockValidPDF);
    expect(result.details).toEqual({
      fileType: 'application/pdf',
      fileSize: expect.any(Number)
    });
  });
});

describe('Login Schema Validation', () => {
  const validLoginData = {
    email: 'test@example.com',
    password: 'Test@12345678',
    mfaCode: '123456'
  };

  it('should validate correct login data', () => {
    const result = loginSchema.safeParse(validLoginData);
    expect(result.success).toBe(true);
  });

  it('should allow login without MFA code', () => {
    const { mfaCode, ...loginDataWithoutMFA } = validLoginData;
    const result = loginSchema.safeParse(loginDataWithoutMFA);
    expect(result.success).toBe(true);
  });

  it('should reject invalid MFA code format', () => {
    const invalidMFAData = { ...validLoginData, mfaCode: '12345' }; // 5 digits
    const result = loginSchema.safeParse(invalidMFAData);
    expect(result.success).toBe(false);
  });

  it('should reject non-numeric MFA code', () => {
    const invalidMFAData = { ...validLoginData, mfaCode: '12345a' };
    const result = loginSchema.safeParse(invalidMFAData);
    expect(result.success).toBe(false);
  });
});

describe('Registration Schema Validation', () => {
  const validRegistrationData = {
    email: 'test@example.com',
    password: 'Test@12345678',
    confirmPassword: 'Test@12345678',
    firstName: 'John',
    lastName: 'Doe',
    organizationId: '123e4567-e89b-12d3-a456-426614174000',
    phoneNumber: '+1234567890'
  };

  it('should validate correct registration data', () => {
    const result = registerSchema.safeParse(validRegistrationData);
    expect(result.success).toBe(true);
  });

  it('should reject mismatched passwords', () => {
    const data = {
      ...validRegistrationData,
      confirmPassword: 'DifferentPassword@123'
    };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid names', () => {
    const data = {
      ...validRegistrationData,
      firstName: 'John123', // Contains numbers
      lastName: '<script>alert("xss")</script>' // XSS attempt
    };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid organization ID', () => {
    const data = {
      ...validRegistrationData,
      organizationId: 'invalid-uuid'
    };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid phone numbers', () => {
    const data = {
      ...validRegistrationData,
      phoneNumber: '123' // Too short
    };
    const result = registerSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});