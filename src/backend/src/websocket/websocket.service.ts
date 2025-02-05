import { Injectable } from '@nestjs/common'; // @version ^10.0.0
import { Server, Socket } from 'socket.io'; // @version ^4.7.0
import { createAdapter } from '@socket.io/redis-adapter'; // @version ^8.2.1
import { CircuitBreaker } from 'opossum'; // @version ^7.1.0
import { RateLimiter } from 'rate-limiter-flexible'; // @version ^2.4.1
import { AuthMiddleware } from '@nestjs/common'; // @version ^10.0.0

import { InterviewWebSocketHandler } from './handlers/interview.handler';
import { NotificationHandler } from './handlers/notification.handler';
import { Logger } from '../utils/logger';

@Injectable()
export class WebSocketService {
  private readonly io: Server;
  private readonly connectedClients: Map<string, Socket>;
  private readonly clientTenants: Map<string, string>;
  private readonly broadcastBreaker: CircuitBreaker;
  private readonly logger: Logger;

  constructor(
    private readonly interviewHandler: InterviewWebSocketHandler,
    private readonly notificationHandler: NotificationHandler,
    private readonly authMiddleware: AuthMiddleware,
    private readonly rateLimiter: RateLimiter
  ) {
    this.io = new Server({
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      maxHttpBufferSize: 1e6, // 1MB max message size
      pingTimeout: 30000,
      pingInterval: 25000
    });

    this.connectedClients = new Map();
    this.clientTenants = new Map();
    this.logger = new Logger({ service: 'WebSocketService', redactPII: true });

    // Initialize circuit breaker for broadcast protection
    this.broadcastBreaker = new CircuitBreaker(
      async (event: string, data: any, rooms: string[]) => {
        rooms.forEach(room => {
          this.io.to(room).emit(event, data);
        });
      },
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }
    );

    this.setupCircuitBreakerEvents();
  }

  /**
   * Initializes the WebSocket server with security and monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Set up Redis adapter for clustering support
      const pubClient = await this.createRedisClient();
      const subClient = pubClient.duplicate();
      
      this.io.adapter(createAdapter(pubClient, subClient));

      // Set up middleware pipeline
      this.setupMiddleware();

      // Initialize handlers
      await this.notificationHandler.initialize();

      // Set up event listeners
      this.setupEventListeners();

      this.logger.info('WebSocket server initialized successfully');
    } catch (error) {
      this.logger.error('WebSocket server initialization failed', { error });
      throw error;
    }
  }

  /**
   * Handles new WebSocket connections with tenant isolation
   */
  public async handleConnection(socket: Socket, tenantId: string): Promise<void> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(socket.handshake.address);

      // Validate tenant access
      if (!await this.validateTenantAccess(socket, tenantId)) {
        throw new Error('Invalid tenant access');
      }

      // Store client with tenant association
      this.connectedClients.set(socket.id, socket);
      this.clientTenants.set(socket.id, tenantId);

      // Join tenant-specific room
      socket.join(`tenant:${tenantId}`);

      // Set up tenant-specific handlers
      await this.interviewHandler.handleConnection(
        socket,
        socket.handshake.auth.interviewId,
        socket.handshake.auth.token
      );

      // Initialize monitoring
      this.initializeClientMonitoring(socket);

      this.logger.info('Client connected successfully', {
        socketId: socket.id,
        tenantId,
        clientIp: socket.handshake.address
      });
    } catch (error) {
      this.logger.error('Connection handling failed', { error, socketId: socket.id });
      socket.emit('error', { message: 'Connection failed' });
      socket.disconnect(true);
    }
  }

  /**
   * Handles client disconnections with cleanup
   */
  public async handleDisconnect(socket: Socket): Promise<void> {
    try {
      // Clean up client tracking
      this.connectedClients.delete(socket.id);
      const tenantId = this.clientTenants.get(socket.id);
      this.clientTenants.delete(socket.id);

      // Notify handlers
      await this.interviewHandler.handleDisconnect(socket);

      // Update monitoring metrics
      this.updateDisconnectMetrics(socket, tenantId);

      this.logger.info('Client disconnected', {
        socketId: socket.id,
        tenantId
      });
    } catch (error) {
      this.logger.error('Disconnect handling failed', { error, socketId: socket.id });
    }
  }

  /**
   * Broadcasts messages with tenant isolation and circuit breaking
   */
  public async broadcast(
    event: string,
    data: any,
    rooms: string[],
    tenantId: string
  ): Promise<void> {
    try {
      // Validate tenant access
      if (!this.validateBroadcastAccess(tenantId, rooms)) {
        throw new Error('Invalid broadcast access');
      }

      // Rate limiting for broadcasts
      await this.rateLimiter.consume(`broadcast:${tenantId}`);

      // Sanitize broadcast data
      const sanitizedData = this.sanitizeBroadcastData(data);

      // Apply circuit breaker
      await this.broadcastBreaker.fire(event, sanitizedData, rooms);

      this.logger.info('Broadcast sent successfully', {
        event,
        rooms,
        tenantId
      });
    } catch (error) {
      this.logger.error('Broadcast failed', { error, event, tenantId });
      throw error;
    }
  }

  /**
   * Sets up WebSocket middleware pipeline
   */
  private setupMiddleware(): void {
    this.io.use(this.authMiddleware.use.bind(this.authMiddleware));
    this.io.use(this.rateLimitMiddleware.bind(this));
    this.io.use(this.tenantIsolationMiddleware.bind(this));
  }

  /**
   * Sets up circuit breaker monitoring
   */
  private setupCircuitBreakerEvents(): void {
    this.broadcastBreaker.on('open', () => {
      this.logger.error('Broadcast circuit breaker opened');
    });

    this.broadcastBreaker.on('halfOpen', () => {
      this.logger.info('Broadcast circuit breaker half-open');
    });

    this.broadcastBreaker.on('close', () => {
      this.logger.info('Broadcast circuit breaker closed');
    });
  }

  /**
   * Validates tenant access for connections
   */
  private async validateTenantAccess(socket: Socket, tenantId: string): Promise<boolean> {
    // Implementation would validate against tenant service
    return true;
  }

  /**
   * Validates broadcast access for tenants
   */
  private validateBroadcastAccess(tenantId: string, rooms: string[]): boolean {
    return rooms.every(room => room.startsWith(`tenant:${tenantId}`));
  }

  /**
   * Sanitizes broadcast data for security
   */
  private sanitizeBroadcastData(data: any): any {
    // Implementation would sanitize sensitive data
    return data;
  }

  /**
   * Initializes monitoring for new client connections
   */
  private initializeClientMonitoring(socket: Socket): void {
    // Implementation would set up client-specific monitoring
  }

  /**
   * Updates metrics on client disconnect
   */
  private updateDisconnectMetrics(socket: Socket, tenantId?: string): void {
    // Implementation would update monitoring metrics
  }

  /**
   * Rate limiting middleware
   */
  private async rateLimitMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      await this.rateLimiter.consume(socket.handshake.address);
      next();
    } catch (error) {
      next(new Error('Rate limit exceeded'));
    }
  }

  /**
   * Tenant isolation middleware
   */
  private async tenantIsolationMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
    const tenantId = socket.handshake.auth.tenantId;
    if (!tenantId) {
      next(new Error('Tenant ID required'));
      return;
    }
    next();
  }

  /**
   * Creates Redis client for adapter
   */
  private async createRedisClient() {
    // Implementation would create and configure Redis client
    return null;
  }

  /**
   * Sets up WebSocket event listeners
   */
  private setupEventListeners(): void {
    this.io.on('connection', (socket: Socket) => {
      const tenantId = socket.handshake.auth.tenantId;
      this.handleConnection(socket, tenantId);

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }
}