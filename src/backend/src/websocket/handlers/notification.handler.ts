import { Socket } from 'socket.io'; // @version ^4.7.0
import { Redis } from 'ioredis'; // @version ^5.3.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // @version ^2.4.1
import jwt from 'jsonwebtoken'; // @version ^9.0.0
import { SecureLogger as Logger } from '../../utils/logger';
import { NotificationService } from '../../services/background/notification.service';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { UserRole } from '../../types/user.types';
import { SECURITY_CONFIG } from '../../utils/constants';

/**
 * Interface for WebSocket connection metadata tracking
 */
interface ConnectionMetadata {
  userId: string;
  organizationId: string;
  role: UserRole;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
}

/**
 * Interface for subscription request validation
 */
interface SubscriptionRequest {
  channels: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced WebSocket notification handler with security and multi-tenant support
 */
export class NotificationHandler {
  private readonly logger: Logger;
  private readonly userSubscriptions: Map<string, Set<string>>;
  private readonly connectionTracker: Map<string, ConnectionMetadata>;
  private readonly rateLimiter: RateLimiterRedis;

  constructor(
    private readonly notificationService: NotificationService,
    private readonly redisClient: Redis
  ) {
    this.logger = new Logger();
    this.userSubscriptions = new Map();
    this.connectionTracker = new Map();
    
    // Initialize rate limiter with Redis
    this.rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: 100, // Number of connections allowed
      duration: 60, // Per 60 seconds
      blockDuration: 60 * 2 // Block for 2 minutes if exceeded
    });
  }

  /**
   * Initializes the notification handler with security configurations
   */
  public async initialize(): Promise<void> {
    try {
      // Set up Redis subscribers for different notification channels
      await this.setupRedisSubscribers();
      
      // Initialize connection monitoring
      this.startConnectionMonitoring();
      
      this.logger.info('NotificationHandler initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize NotificationHandler', { error });
      throw error;
    }
  }

  /**
   * Handles new WebSocket connections with security validation
   */
  public async handleConnection(socket: Socket): Promise<void> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(socket.handshake.address);

      // Validate JWT token
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new UnauthorizedError('Authentication token required');
      }

      const decoded = jwt.verify(token, SECURITY_CONFIG.JWT_SECRET) as {
        userId: string;
        organizationId: string;
        role: UserRole;
      };

      // Initialize connection metadata
      const metadata: ConnectionMetadata = {
        userId: decoded.userId,
        organizationId: decoded.organizationId,
        role: decoded.role,
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set()
      };

      // Store connection metadata
      this.connectionTracker.set(socket.id, metadata);

      // Set up socket event listeners
      this.setupSocketEventListeners(socket, metadata);

      // Join organization-specific room
      socket.join(`org:${decoded.organizationId}`);

      this.logger.info('Client connected successfully', {
        socketId: socket.id,
        userId: decoded.userId,
        organizationId: decoded.organizationId
      });
    } catch (error) {
      this.logger.error('Connection handling failed', { error, socketId: socket.id });
      socket.disconnect(true);
    }
  }

  /**
   * Handles subscription requests with access control
   */
  public async handleSubscribe(
    socket: Socket,
    request: SubscriptionRequest
  ): Promise<void> {
    try {
      const metadata = this.connectionTracker.get(socket.id);
      if (!metadata) {
        throw new UnauthorizedError('Invalid connection');
      }

      // Validate channel access permissions
      const allowedChannels = await this.validateChannelAccess(
        request.channels,
        metadata
      );

      // Subscribe to allowed channels
      for (const channel of allowedChannels) {
        socket.join(channel);
        metadata.subscriptions.add(channel);
      }

      // Update connection metadata
      metadata.lastActivity = new Date();
      this.connectionTracker.set(socket.id, metadata);

      this.logger.info('Subscription successful', {
        socketId: socket.id,
        userId: metadata.userId,
        channels: allowedChannels
      });

      // Send confirmation
      socket.emit('subscribed', { channels: allowedChannels });
    } catch (error) {
      this.logger.error('Subscription failed', { error, socketId: socket.id });
      socket.emit('error', { message: 'Subscription failed' });
    }
  }

  /**
   * Sets up secure Redis subscribers for notification channels
   */
  private async setupRedisSubscribers(): Promise<void> {
    const subscriber = this.redisClient.duplicate();
    
    subscriber.on('message', (channel, message) => {
      try {
        const notification = JSON.parse(message);
        this.broadcastNotification(channel, notification);
      } catch (error) {
        this.logger.error('Redis message processing failed', { error, channel });
      }
    });

    // Subscribe to notification channels
    await subscriber.subscribe(
      'background-checks',
      'interviews',
      'documents',
      'system'
    );
  }

  /**
   * Sets up socket event listeners with security controls
   */
  private setupSocketEventListeners(
    socket: Socket,
    metadata: ConnectionMetadata
  ): void {
    socket.on('subscribe', (request: SubscriptionRequest) => {
      this.handleSubscribe(socket, request);
    });

    socket.on('disconnect', () => {
      this.handleDisconnect(socket.id);
    });

    socket.on('ping', () => {
      metadata.lastActivity = new Date();
      this.connectionTracker.set(socket.id, metadata);
      socket.emit('pong');
    });
  }

  /**
   * Validates channel access based on user role and organization
   */
  private async validateChannelAccess(
    channels: string[],
    metadata: ConnectionMetadata
  ): Promise<string[]> {
    const allowedChannels: string[] = [];

    for (const channel of channels) {
      // Validate channel format
      if (!this.isValidChannelFormat(channel)) {
        continue;
      }

      // Check organization-specific access
      if (channel.startsWith(`org:${metadata.organizationId}`)) {
        allowedChannels.push(channel);
        continue;
      }

      // Check role-based access
      if (this.hasChannelPermission(channel, metadata.role)) {
        allowedChannels.push(channel);
      }
    }

    return allowedChannels;
  }

  /**
   * Validates channel name format
   */
  private isValidChannelFormat(channel: string): boolean {
    return /^[a-zA-Z0-9:_-]+$/.test(channel);
  }

  /**
   * Checks if user role has permission for channel
   */
  private hasChannelPermission(channel: string, role: UserRole): boolean {
    // Implement role-based channel access control
    const rolePermissions: Record<UserRole, string[]> = {
      [UserRole.SYSTEM_ADMIN]: ['*'],
      [UserRole.COMPANY_ADMIN]: ['background-checks', 'interviews', 'documents'],
      [UserRole.HR_MANAGER]: ['background-checks', 'interviews'],
      [UserRole.CANDIDATE]: ['personal']
    };

    return rolePermissions[role].includes('*') || 
           rolePermissions[role].includes(channel);
  }

  /**
   * Broadcasts notification to authorized subscribers
   */
  private broadcastNotification(
    channel: string,
    notification: Record<string, unknown>
  ): void {
    try {
      // Add security context and timestamp
      const secureNotification = {
        ...notification,
        timestamp: new Date().toISOString(),
        channel
      };

      // Broadcast to authorized subscribers
      this.notificationService.processRealtimeNotification(
        channel,
        secureNotification
      );
    } catch (error) {
      this.logger.error('Broadcast failed', { error, channel });
    }
  }

  /**
   * Handles client disconnection and cleanup
   */
  private handleDisconnect(socketId: string): void {
    const metadata = this.connectionTracker.get(socketId);
    if (metadata) {
      // Clean up subscriptions
      this.userSubscriptions.delete(metadata.userId);
      this.connectionTracker.delete(socketId);

      this.logger.info('Client disconnected', {
        socketId,
        userId: metadata.userId
      });
    }
  }

  /**
   * Monitors connections for inactivity and security
   */
  private startConnectionMonitoring(): void {
    setInterval(() => {
      const now = new Date();
      for (const [socketId, metadata] of this.connectionTracker.entries()) {
        // Check for inactive connections (5 minutes threshold)
        if (now.getTime() - metadata.lastActivity.getTime() > 5 * 60 * 1000) {
          this.logger.warn('Closing inactive connection', { socketId });
          // Implement connection closure logic
        }
      }
    }, 60 * 1000); // Check every minute
  }
}