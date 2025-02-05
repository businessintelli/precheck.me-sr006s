import { config } from 'dotenv';
import { SECURITY_CONFIG } from '../utils/constants';

// Initialize environment variables
config();

/**
 * Interface for email template configuration
 */
interface IEmailTemplate {
  id: string;
  description: string;
  version: string;
  requiredFields: string[];
}

/**
 * Interface for email configuration
 */
interface IEmailConfig {
  apiKey: string;
  from: string;
  fromName: string;
  templates: Record<string, IEmailTemplate>;
  rateLimit: number;
  security: {
    encryptionAlgorithm: string;
    maxRetries: number;
    timeout: number;
  };
}

/**
 * Email template configurations for different notification types
 */
const emailTemplates: Record<string, IEmailTemplate> = {
  verification: {
    id: 'd-verification-template-id',
    description: 'Template for background check verification requests',
    version: '1.0',
    requiredFields: ['candidateName', 'verificationLink', 'expiryDate']
  },
  interview: {
    id: 'd-interview-template-id',
    description: 'Template for AI interview invitations',
    version: '1.0',
    requiredFields: ['candidateName', 'interviewLink', 'scheduleDate']
  },
  completion: {
    id: 'd-completion-template-id',
    description: 'Template for background check completion notifications',
    version: '1.0',
    requiredFields: ['candidateName', 'reportLink', 'completionDate']
  },
  reset_password: {
    id: 'd-reset-password-template-id',
    description: 'Template for password reset emails',
    version: '1.0',
    requiredFields: ['userName', 'resetLink', 'expiryTime']
  },
  notification: {
    id: 'd-notification-template-id',
    description: 'Template for general system notifications',
    version: '1.0',
    requiredFields: ['recipientName', 'messageContent', 'actionLink']
  }
};

/**
 * Validates email configuration settings and template availability
 * @throws Error if configuration is invalid
 */
function validateEmailConfig(): void {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error('SendGrid API key is required');
  }

  if (!process.env.DEFAULT_FROM_EMAIL?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    throw new Error('Invalid default sender email format');
  }

  if (!process.env.DEFAULT_FROM_NAME || process.env.DEFAULT_FROM_NAME.length < 2) {
    throw new Error('Default sender name is required and must be at least 2 characters');
  }

  const rateLimit = parseInt(process.env.EMAIL_RATE_LIMIT || '100', 10);
  if (isNaN(rateLimit) || rateLimit < 1) {
    throw new Error('Invalid email rate limit configuration');
  }

  // Validate all template IDs are properly formatted
  Object.values(emailTemplates).forEach(template => {
    if (!template.id.startsWith('d-') || template.id.length !== 34) {
      throw new Error(`Invalid template ID format: ${template.id}`);
    }
  });
}

/**
 * Retrieves and validates email template configuration
 * @param templateType - Type of email template to retrieve
 * @returns Validated template configuration
 * @throws Error if template is not found or invalid
 */
function getEmailTemplate(templateType: string): IEmailTemplate {
  const template = emailTemplates[templateType];
  if (!template) {
    throw new Error(`Email template not found: ${templateType}`);
  }

  if (!template.id || !template.requiredFields || !template.version) {
    throw new Error(`Invalid template configuration for: ${templateType}`);
  }

  return template;
}

// Validate configuration on initialization
validateEmailConfig();

/**
 * Comprehensive email configuration with security settings
 */
export const emailConfig: IEmailConfig = {
  apiKey: process.env.SENDGRID_API_KEY!,
  from: process.env.DEFAULT_FROM_EMAIL!,
  fromName: process.env.DEFAULT_FROM_NAME!,
  templates: emailTemplates,
  rateLimit: parseInt(process.env.EMAIL_RATE_LIMIT || '100', 10),
  security: {
    encryptionAlgorithm: SECURITY_CONFIG.ENCRYPTION_ALGORITHM,
    maxRetries: 3,
    timeout: 30000 // 30 seconds
  }
};

/**
 * Export utility functions for email configuration management
 */
export {
  validateEmailConfig,
  getEmailTemplate,
  type IEmailTemplate,
  type IEmailConfig
};