import sgMail from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
import { emailConfig } from '../../config/email.config';
import { logger } from '../../utils/logger';
import { InternalServerError } from '../../utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for email sending result with tracking information
 */
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  trackingId: string;
  timestamp: Date;
}

/**
 * Interface for verification email data
 */
interface VerificationEmailData {
  candidateName: string;
  verificationLink: string;
  expiryDate: string;
  companyName?: string;
}

/**
 * Interface for interview invitation email data
 */
interface InterviewInviteData {
  candidateName: string;
  interviewLink: string;
  scheduleDate: string;
  interviewType: string;
  duration: number;
}

/**
 * Interface for completion notification email data
 */
interface CompletionNotificationData {
  candidateName: string;
  reportLink: string;
  completionDate: string;
  status: string;
  summary?: string;
}

/**
 * Email service class for handling all email communications
 */
export class EmailService {
  private readonly mailClient: typeof sgMail;
  private readonly apiClient: typeof sgClient;
  private readonly rateLimiter: Map<string, number>;
  private readonly maxRetries: number = 3;

  constructor() {
    this.mailClient = sgMail;
    this.apiClient = sgClient;
    this.mailClient.setApiKey(emailConfig.apiKey);
    this.apiClient.setApiKey(emailConfig.apiKey);
    this.rateLimiter = new Map();

    // Initialize monitoring
    this.setupMonitoring();
  }

  /**
   * Sets up email monitoring and analytics
   */
  private setupMonitoring(): void {
    this.mailClient.on('response', (response) => {
      logger.info('Email sent successfully', {
        messageId: response.headers['x-message-id'],
        timestamp: new Date().toISOString()
      });
    });

    this.mailClient.on('error', (error) => {
      logger.error('Email sending failed', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Checks rate limits for email sending
   */
  private checkRateLimit(email: string): boolean {
    const now = Date.now();
    const lastSent = this.rateLimiter.get(email) || 0;
    
    if (now - lastSent < emailConfig.rateLimits.minInterval) {
      return false;
    }
    
    this.rateLimiter.set(email, now);
    return true;
  }

  /**
   * Sends verification email to candidates
   */
  public async sendVerificationEmail(
    to: string,
    data: VerificationEmailData
  ): Promise<EmailResult> {
    try {
      if (!this.checkRateLimit(to)) {
        throw new Error('Rate limit exceeded for email sending');
      }

      const trackingId = uuidv4();
      const msg = {
        to,
        from: {
          email: emailConfig.from,
          name: emailConfig.fromName
        },
        templateId: emailConfig.templates.verification.id,
        dynamicTemplateData: {
          ...data,
          trackingId
        },
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const response = await this.mailClient.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers['x-message-id'],
        trackingId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to send verification email', { error, to });
      throw new InternalServerError('Email sending failed', { error });
    }
  }

  /**
   * Sends interview invitation email to candidates
   */
  public async sendInterviewInvitation(
    to: string,
    data: InterviewInviteData
  ): Promise<EmailResult> {
    try {
      if (!this.checkRateLimit(to)) {
        throw new Error('Rate limit exceeded for email sending');
      }

      const trackingId = uuidv4();
      const msg = {
        to,
        from: {
          email: emailConfig.from,
          name: emailConfig.fromName
        },
        templateId: emailConfig.templates.interview.id,
        dynamicTemplateData: {
          ...data,
          trackingId
        },
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const response = await this.mailClient.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers['x-message-id'],
        trackingId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to send interview invitation', { error, to });
      throw new InternalServerError('Email sending failed', { error });
    }
  }

  /**
   * Sends completion notification email
   */
  public async sendCompletionNotification(
    to: string,
    data: CompletionNotificationData
  ): Promise<EmailResult> {
    try {
      if (!this.checkRateLimit(to)) {
        throw new Error('Rate limit exceeded for email sending');
      }

      const trackingId = uuidv4();
      const msg = {
        to,
        from: {
          email: emailConfig.from,
          name: emailConfig.fromName
        },
        templateId: emailConfig.templates.completion.id,
        dynamicTemplateData: {
          ...data,
          trackingId
        },
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      };

      const response = await this.mailClient.send(msg);
      
      return {
        success: true,
        messageId: response[0]?.headers['x-message-id'],
        trackingId,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to send completion notification', { error, to });
      throw new InternalServerError('Email sending failed', { error });
    }
  }

  /**
   * Monitors email delivery events and updates tracking
   */
  public async monitorEmailDelivery(event: any): Promise<void> {
    try {
      const { trackingId, event: eventType, email } = event;

      logger.info('Email event received', {
        trackingId,
        eventType,
        email,
        timestamp: new Date().toISOString()
      });

      // Handle different event types
      switch (eventType) {
        case 'delivered':
          await this.handleDeliverySuccess(trackingId);
          break;
        case 'bounce':
          await this.handleDeliveryFailure(trackingId, 'bounced');
          break;
        case 'dropped':
          await this.handleDeliveryFailure(trackingId, 'dropped');
          break;
        case 'spamreport':
          await this.handleSpamReport(trackingId);
          break;
      }
    } catch (error) {
      logger.error('Failed to process email event', { error, event });
    }
  }

  /**
   * Handles successful email delivery
   */
  private async handleDeliverySuccess(trackingId: string): Promise<void> {
    logger.info('Email delivered successfully', { trackingId });
  }

  /**
   * Handles email delivery failures
   */
  private async handleDeliveryFailure(trackingId: string, reason: string): Promise<void> {
    logger.error('Email delivery failed', { trackingId, reason });
  }

  /**
   * Handles spam reports
   */
  private async handleSpamReport(trackingId: string): Promise<void> {
    logger.warn('Email marked as spam', { trackingId });
  }
}