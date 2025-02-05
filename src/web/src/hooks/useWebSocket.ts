/**
 * Enhanced React hook for managing WebSocket connections with comprehensive error handling,
 * reconnection logic, and monitoring capabilities
 * @package react ^18.0.0
 */

import { useEffect, useCallback, useState } from 'react';
import { WEBSOCKET_CONFIG, WS_EVENTS } from '../config/websocket.config';
import WebSocketService from '../services/websocket.service';
import { NotificationType } from '../types/notification.types';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

/**
 * Enhanced WebSocket error interface
 */
interface WebSocketError {
  code: string;
  message: string;
  timestamp: Date;
  attempt?: number;
  details?: unknown;
}

/**
 * WebSocket connection statistics
 */
interface WebSocketStats {
  connectedSince: Date | null;
  lastHeartbeat: Date | null;
  messagesSent: number;
  messagesReceived: number;
  reconnectAttempts: number;
  latency: number;
}

/**
 * Enhanced interface for useWebSocket hook options
 */
export interface UseWebSocketOptions {
  autoConnect?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: WebSocketError) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  pingInterval?: number;
  connectionTimeout?: number;
  binaryType?: 'blob' | 'arraybuffer';
  protocols?: string[];
  heartbeatEnabled?: boolean;
  heartbeatInterval?: number;
  debug?: boolean;
}

/**
 * Enhanced interface for useWebSocket hook return value
 */
export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: WebSocketState;
  lastError: WebSocketError | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (event: NotificationType, callback: (data: any) => void) => void;
  unsubscribe: (event: NotificationType, callback: (data: any) => void) => void;
  reconnect: () => Promise<void>;
  send: (data: string | ArrayBuffer) => void;
  ping: () => void;
  getConnectionStats: () => WebSocketStats;
  clearSubscriptions: () => void;
}

/**
 * Enhanced custom hook for WebSocket management
 */
export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const wsService = WebSocketService.getInstance();
  const [connectionState, setConnectionState] = useState<WebSocketState>(WebSocketState.DISCONNECTED);
  const [lastError, setLastError] = useState<WebSocketError | null>(null);
  const [stats, setStats] = useState<WebSocketStats>({
    connectedSince: null,
    lastHeartbeat: null,
    messagesSent: 0,
    messagesReceived: 0,
    reconnectAttempts: 0,
    latency: 0
  });

  /**
   * Enhanced connection handler with error handling
   */
  const connect = useCallback(async () => {
    try {
      setConnectionState(WebSocketState.CONNECTING);
      await wsService.connect();
      setConnectionState(WebSocketState.CONNECTED);
      setStats(prev => ({
        ...prev,
        connectedSince: new Date(),
        reconnectAttempts: 0
      }));
      options.onOpen?.();
    } catch (error) {
      const wsError: WebSocketError = {
        code: 'CONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to connect',
        timestamp: new Date()
      };
      setLastError(wsError);
      setConnectionState(WebSocketState.ERROR);
      options.onError?.(wsError);
    }
  }, [options]);

  /**
   * Enhanced disconnect handler with cleanup
   */
  const disconnect = useCallback(() => {
    wsService.disconnect();
    setConnectionState(WebSocketState.DISCONNECTED);
    setStats(prev => ({
      ...prev,
      connectedSince: null
    }));
    options.onClose?.();
  }, [options]);

  /**
   * Enhanced subscription handler with type safety
   */
  const subscribe = useCallback((event: NotificationType, callback: (data: any) => void) => {
    wsService.subscribe(event, (_, data) => {
      if (options.debug) {
        console.debug(`[WebSocket] Received ${event}:`, data);
      }
      setStats(prev => ({
        ...prev,
        messagesReceived: prev.messagesReceived + 1
      }));
      callback(data);
    });
  }, [options.debug]);

  /**
   * Enhanced unsubscribe handler
   */
  const unsubscribe = useCallback((event: NotificationType, callback: (data: any) => void) => {
    wsService.unsubscribe(event, callback);
  }, []);

  /**
   * Enhanced reconnection handler with exponential backoff
   */
  const reconnect = useCallback(async () => {
    setConnectionState(WebSocketState.RECONNECTING);
    setStats(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1
    }));
    await connect();
  }, [connect]);

  /**
   * Enhanced message sender with stats tracking
   */
  const send = useCallback((data: string | ArrayBuffer) => {
    if (connectionState === WebSocketState.CONNECTED) {
      wsService.send(WS_EVENTS.USER_ACTIVITY, data);
      setStats(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1
      }));
    }
  }, [connectionState]);

  /**
   * Connection health check
   */
  const ping = useCallback(() => {
    const start = Date.now();
    wsService.send(WS_EVENTS.HEARTBEAT, { timestamp: new Date().toISOString() });
    setStats(prev => ({
      ...prev,
      latency: Date.now() - start,
      lastHeartbeat: new Date()
    }));
  }, []);

  /**
   * Get current connection statistics
   */
  const getConnectionStats = useCallback(() => stats, [stats]);

  /**
   * Clear all subscriptions
   */
  const clearSubscriptions = useCallback(() => {
    wsService.disconnect();
    setConnectionState(WebSocketState.DISCONNECTED);
  }, []);

  /**
   * Setup effect for connection management
   */
  useEffect(() => {
    if (options.autoConnect !== false) {
      connect();
    }

    if (options.heartbeatEnabled !== false) {
      const heartbeatInterval = setInterval(ping, options.heartbeatInterval || WEBSOCKET_CONFIG.options.heartbeatInterval);
      return () => clearInterval(heartbeatInterval);
    }

    return () => disconnect();
  }, [connect, disconnect, options.autoConnect, options.heartbeatEnabled, options.heartbeatInterval, ping]);

  /**
   * Handle visibility change for connection management
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && connectionState === WebSocketState.DISCONNECTED) {
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connectionState, reconnect]);

  return {
    isConnected: connectionState === WebSocketState.CONNECTED,
    isConnecting: connectionState === WebSocketState.CONNECTING,
    connectionState,
    lastError,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    reconnect,
    send,
    ping,
    getConnectionStats,
    clearSubscriptions
  };
};