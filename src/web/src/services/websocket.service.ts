/**
 * WebSocket service implementation for Precheck.me platform
 * Manages real-time communication with enhanced reliability and monitoring
 * @package ws ^8.14.2
 */

import { WEBSOCKET_CONFIG, WS_EVENTS, WebSocketMessage, WebSocketEventPayloads } from '../config/websocket.config';
import { NotificationType } from '../types/notification.types';

/**
 * Interface for WebSocket event handler with improved type safety
 */
interface WebSocketEventHandler {
  (event: NotificationType, data: unknown, timestamp: Date, metadata: Record<string, unknown>): void;
}

/**
 * Interface for WebSocket service state tracking
 */
interface WebSocketServiceState {
  isConnected: boolean;
  retryCount: number;
  socket: WebSocket | null;
  lastHeartbeat: Date | null;
  connectionAttempts: number;
  lastError: Error | null;
}

/**
 * Enhanced singleton service class for managing WebSocket connections
 */
class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private eventHandlers: Map<NotificationType, Set<WebSocketEventHandler>> = new Map();
  private retryCount = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionState: WebSocketServiceState = {
    isConnected: false,
    retryCount: 0,
    socket: null,
    lastHeartbeat: null,
    connectionAttempts: 0,
    lastError: null
  };
  private readonly maxRetries = WEBSOCKET_CONFIG.options.maxRetries;
  private readonly backoffMultiplier = 1.5;
  private messageQueue: Array<{ type: string; payload: unknown }> = [];

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance of WebSocketService
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Establishes WebSocket connection with enhanced error handling
   */
  public async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.socket = new WebSocket(WEBSOCKET_CONFIG.url);
      this.setupEventListeners();
      await this.waitForConnection();
      this.startHeartbeat();
      this.processMessageQueue();
    } catch (error) {
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Gracefully closes WebSocket connection with cleanup
   */
  public disconnect(): void {
    this.clearTimers();
    if (this.socket) {
      this.socket.close(1000, 'Client disconnecting');
      this.socket = null;
    }
    this.resetState();
  }

  /**
   * Subscribe to WebSocket events with type safety
   */
  public subscribe(type: NotificationType, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)?.add(handler);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  public unsubscribe(type: NotificationType, handler: WebSocketEventHandler): void {
    this.eventHandlers.get(type)?.delete(handler);
  }

  /**
   * Send message through WebSocket with queuing for offline support
   */
  public send(type: string, payload: unknown): void {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      this.messageQueue.push({ type, payload });
      this.connect();
    }
  }

  /**
   * Get current connection state
   */
  public getConnectionState(): WebSocketServiceState {
    return { ...this.connectionState };
  }

  /**
   * Set up WebSocket event listeners with error handling
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.connectionState.isConnected = true;
      this.connectionState.retryCount = 0;
      this.connectionState.lastError = null;
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.handleClose(event);
    };

    this.socket.onerror = (error: Event) => {
      this.handleConnectionError(error);
    };
  }

  /**
   * Handle incoming WebSocket messages with type checking
   */
  private handleMessage(message: WebSocketMessage): void {
    const { event, data, timestamp } = message;
    const handlers = this.eventHandlers.get(event as NotificationType);
    
    if (handlers) {
      const messageTimestamp = new Date(timestamp);
      handlers.forEach(handler => {
        try {
          handler(event as NotificationType, data, messageTimestamp, {});
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  /**
   * Handle WebSocket connection close with reconnection logic
   */
  private handleClose(event: CloseEvent): void {
    this.connectionState.isConnected = false;
    
    if (!event.wasClean && this.connectionState.retryCount < this.maxRetries) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket errors with logging and recovery
   */
  private handleConnectionError(error: Error | Event): void {
    this.connectionState.lastError = error instanceof Error ? error : new Error('WebSocket error');
    this.connectionState.isConnected = false;
    
    if (this.connectionState.retryCount < this.maxRetries) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    const backoffDelay = Math.min(
      WEBSOCKET_CONFIG.options.reconnectInterval * Math.pow(this.backoffMultiplier, this.connectionState.retryCount),
      30000 // Max 30 second delay
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connectionState.retryCount++;
      this.connectionState.connectionAttempts++;
      this.connect();
    }, backoffDelay);
  }

  /**
   * Start heartbeat mechanism for connection monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send(WS_EVENTS.HEARTBEAT, { timestamp: new Date().toISOString() });
        this.connectionState.lastHeartbeat = new Date();
      }
    }, WEBSOCKET_CONFIG.options.heartbeatInterval);
  }

  /**
   * Process queued messages after reconnection
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message.type, message.payload);
      }
    }
  }

  /**
   * Wait for WebSocket connection to establish
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, WEBSOCKET_CONFIG.options.connectionTimeout);

      if (this.socket) {
        this.socket.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };
        this.socket.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      }
    });
  }

  /**
   * Clear all timers and intervals
   */
  private clearTimers(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Reset service state
   */
  private resetState(): void {
    this.connectionState = {
      isConnected: false,
      retryCount: 0,
      socket: null,
      lastHeartbeat: null,
      connectionAttempts: 0,
      lastError: null
    };
    this.messageQueue = [];
    this.eventHandlers.clear();
  }
}

export default WebSocketService;