import { Server } from 'socket.io'; // @version ^4.7.0
import Redis from 'ioredis'; // @version ^5.3.0
import rateLimit from 'express-rate-limit'; // @version ^7.1.0
import { EmailService } from '../../integrations/email/email.service';
import { secureLogger as logger } from '../../utils/logger';
import { User } from '../../types/user.types';
import { BackgroundCheckStatus } from '../../types/background-check.types';
import { InterviewStatus } from '../../types/interview.types';
import { DocumentStatus } from '../../types/document.types';
import { RateLimitError, InternalServerError } from '../../utils/errors';

/**
 * Interface for notification payload with comprehensive tracking
 */
interface NotificationPayload {
  type: 'EMAIL' | 'WEBSOCKET' | 'BOTH';
  recipient: {
    userId: string;
    email: string;
  };
  content: {
    template?: string;
    subject?: string;
    message: string;
    data: Record<string, unknown>;
  };
  metadata: {
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    retryCount?: number;
    correlationId: string;
  };
}

/**
 * Enhanced notification service with security, reliability, and monitoring features
 */
export class NotificationService {
  private readonly queuePrefix = 'notifications:';
  private readonly maxRetries = 3;
  private readonly rateLimits: Map<string, number>;
  private readonly processingInterval = 5000; // 5 seconds

  constructor(
    private readonly emailService: EmailService,
    private readonly io: Server,
    private readonly redis: Redis
  ) {
    this.rateLimits = new Map();
    this.setupRedisSubscriber();
    this.startQueueProcessor();
    this.setupWebSocketSecurity();
  }

  /**
   * Sets up secure Redis subscriber for notification events
   */
  private setupRedisSubscriber(): void {
    const subscriber = this.redis.duplicate();
    subscriber.subscribe('notification:events', (err) => {
      if (err) {
        logger.error('Redis subscription error', { error: err });
      }
    });

    subscriber.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message);
        this.handleNotificationEvent(event);
      } catch (error) {
        logger.error('Error processing notification event', { error });
      }
    });
  }

  /**
   * Configures WebSocket security middleware
   */
  private setupWebSocketSecurity(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Implement token verification logic here
      // Verify JWT token and set user data on socket

      next();
    });
  }

  /**
   * Queues a notification with reliability guarantees
   */
  public async queueNotification(payload: NotificationPayload): Promise<string> {
    try {
      const { userId } = payload.recipient;
      if (!this.checkRateLimit(userId)) {
        throw new RateLimitError('Notification rate limit exceeded');
      }

      const queueId = `${this.queuePrefix}${Date.now()}-${userId}`;
      await this.redis.setex(
        queueId,
        3600, // 1 hour expiry
        JSON.stringify({ ...payload, timestamp: new Date().toISOString() })
      );

      logger.info('Notification queued', { queueId, userId });
      return queueId;
    } catch (error) {
      logger.error('Error queueing notification', { error });
      throw new InternalServerError('Failed to queue notification');
    }
  }

  /**
   * Processes notification queue with retry mechanism
   */
  private async processNotificationQueue(): Promise<void> {
    try {
      const pattern = `${this.queuePrefix}*`;
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const payload = await this.redis.get(key);
        if (!payload) continue;

        const notification: NotificationPayload = JSON.parse(payload);
        await this.sendNotification(notification);
        await this.redis.del(key);
      }
    } catch (error) {
      logger.error('Error processing notification queue', { error });
    }
  }

  /**
   * Starts background queue processor
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processNotificationQueue();
    }, this.processingInterval);
  }

  /**
   * Sends background check status notifications
   */
  public async sendBackgroundCheckNotification(
    userId: string,
    checkData: {
      id: string;
      status: BackgroundCheckStatus;
      details: Record<string, unknown>;
    }
  ): Promise<void> {
    const payload: NotificationPayload = {
      type: 'BOTH',
      recipient: {
        userId,
        email: await this.getUserEmail(userId)
      },
      content: {
        template: 'background-check-status',
        subject: `Background Check Status Update: ${checkData.status}`,
        message: `Your background check status has been updated to ${checkData.status}`,
        data: checkData
      },
      metadata: {
        priority: 'HIGH',
        correlationId: checkData.id
      }
    };

    await this.queueNotification(payload);
  }

  /**
   * Sends interview status notifications
   */
  public async sendInterviewNotification(
    userId: string,
    interviewData: {
      id: string;
      status: InterviewStatus;
      scheduledAt: Date;
      details: Record<string, unknown>;
    }
  ): Promise<void> {
    const payload: NotificationPayload = {
      type: 'BOTH',
      recipient: {
        userId,
        email: await this.getUserEmail(userId)
      },
      content: {
        template: 'interview-status',
        subject: `Interview Status: ${interviewData.status}`,
        message: `Your interview status has been updated to ${interviewData.status}`,
        data: interviewData
      },
      metadata: {
        priority: 'HIGH',
        correlationId: interviewData.id
      }
    };

    await this.queueNotification(payload);
  }

  /**
   * Sends document verification notifications
   */
  public async sendDocumentVerificationNotification(
    userId: string,
    documentData: {
      id: string;
      status: DocumentStatus;
      details: Record<string, unknown>;
    }
  ): Promise<void> {
    const payload: NotificationPayload = {
      type: 'BOTH',
      recipient: {
        userId,
        email: await this.getUserEmail(userId)
      },
      content: {
        template: 'document-verification',
        subject: `Document Verification Status: ${documentData.status}`,
        message: `Your document verification status has been updated to ${documentData.status}`,
        data: documentData
      },
      metadata: {
        priority: 'MEDIUM',
        correlationId: documentData.id
      }
    };

    await this.queueNotification(payload);
  }

  /**
   * Handles notification delivery with retry mechanism
   */
  private async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      if (payload.type === 'EMAIL' || payload.type === 'BOTH') {
        await this.emailService.sendTemplatedEmail(
          payload.recipient.email,
          payload.content.template!,
          payload.content.data
        );
      }

      if (payload.type === 'WEBSOCKET' || payload.type === 'BOTH') {
        this.io.to(payload.recipient.userId).emit('notification', {
          message: payload.content.message,
          data: payload.content.data
        });
      }

      logger.info('Notification sent successfully', {
        userId: payload.recipient.userId,
        type: payload.type
      });
    } catch (error) {
      const retryCount = (payload.metadata.retryCount || 0) + 1;
      if (retryCount <= this.maxRetries) {
        payload.metadata.retryCount = retryCount;
        await this.queueNotification(payload);
        logger.warn('Notification retry scheduled', {
          userId: payload.recipient.userId,
          retryCount
        });
      } else {
        logger.error('Notification delivery failed', {
          error,
          userId: payload.recipient.userId
        });
      }
    }
  }

  /**
   * Checks rate limits for notification sending
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const lastNotification = this.rateLimits.get(userId) || 0;
    if (now - lastNotification < 1000) { // 1 second minimum interval
      return false;
    }
    this.rateLimits.set(userId, now);
    return true;
  }

  /**
   * Retrieves user email securely
   */
  private async getUserEmail(userId: string): Promise<string> {
    const userEmail = await this.redis.get(`user:${userId}:email`);
    if (!userEmail) {
      throw new Error('User email not found');
    }
    return userEmail;
  }

  /**
   * Handles notification events from Redis pub/sub
   */
  private handleNotificationEvent(event: any): void {
    logger.info('Notification event received', { event });
    // Implement event handling logic
  }
}