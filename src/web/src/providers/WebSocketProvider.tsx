/**
 * Enhanced WebSocket Context Provider for Precheck.me platform
 * Implements real-time communication with comprehensive monitoring and error handling
 * @package react ^18.0.0
 */

import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { WEBSOCKET_CONFIG, WS_EVENTS } from '../config/websocket.config';
import { NotificationType } from '../types/notification.types';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Interface for WebSocket connection health monitoring
 */
interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'disconnected';
  lastHeartbeat: Date;
  latency: number;
  reconnectAttempts: number;
}

/**
 * Enhanced interface for WebSocket context value
 */
interface WebSocketContextValue {
  isConnected: boolean;
  connectionStats: {
    latency: number;
    reconnectAttempts: number;
    lastConnected: Date;
  };
  connectionHealth: ConnectionHealth;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  subscribe: (event: NotificationType, callback: (data: any) => void) => () => void;
  unsubscribe: (event: NotificationType, callback: (data: any) => void) => void;
}

/**
 * Interface for WebSocket provider props
 */
interface WebSocketProviderProps {
  children: React.ReactNode;
  enableDebug?: boolean;
  onConnectionError?: (error: Error) => void;
}

/**
 * Initial context value with comprehensive monitoring setup
 */
const initialContextValue: WebSocketContextValue = {
  isConnected: false,
  connectionStats: {
    latency: 0,
    reconnectAttempts: 0,
    lastConnected: new Date(),
  },
  connectionHealth: {
    status: 'disconnected',
    lastHeartbeat: new Date(),
    latency: 0,
    reconnectAttempts: 0,
  },
  connect: async () => {},
  disconnect: () => {},
  reconnect: async () => {},
  subscribe: () => () => {},
  unsubscribe: () => {},
};

/**
 * Create WebSocket context with enhanced monitoring capabilities
 */
export const WebSocketContext = createContext<WebSocketContextValue>(initialContextValue);

/**
 * Enhanced WebSocket Provider component with comprehensive monitoring
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  enableDebug = false,
  onConnectionError,
}) => {
  const healthCheckRef = useRef<NodeJS.Timeout>();
  const lastHeartbeatRef = useRef<Date>(new Date());

  const {
    isConnected,
    connectionState,
    lastError,
    connect: wsConnect,
    disconnect: wsDisconnect,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
    reconnect: wsReconnect,
    getConnectionStats,
    ping,
  } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true,
    heartbeatInterval: WEBSOCKET_CONFIG.options.heartbeatInterval,
    debug: enableDebug,
    onError: onConnectionError,
  });

  /**
   * Enhanced connection health monitoring
   */
  const updateConnectionHealth = useCallback(() => {
    const stats = getConnectionStats();
    const now = new Date();
    const timeSinceLastHeartbeat = now.getTime() - lastHeartbeatRef.current.getTime();
    
    let healthStatus: ConnectionHealth['status'] = 'healthy';
    if (!isConnected) {
      healthStatus = 'disconnected';
    } else if (timeSinceLastHeartbeat > WEBSOCKET_CONFIG.options.heartbeatInterval * 2) {
      healthStatus = 'degraded';
    }

    return {
      status: healthStatus,
      lastHeartbeat: lastHeartbeatRef.current,
      latency: stats.latency,
      reconnectAttempts: stats.reconnectAttempts,
    };
  }, [isConnected, getConnectionStats]);

  /**
   * Enhanced subscription handler with automatic cleanup
   */
  const subscribe = useCallback(
    (event: NotificationType, callback: (data: any) => void) => {
      if (enableDebug) {
        console.debug(`[WebSocket] Subscribing to ${event}`);
      }
      
      wsSubscribe(event, callback);
      
      return () => {
        if (enableDebug) {
          console.debug(`[WebSocket] Unsubscribing from ${event}`);
        }
        wsUnsubscribe(event, callback);
      };
    },
    [wsSubscribe, wsUnsubscribe, enableDebug]
  );

  /**
   * Setup health monitoring interval
   */
  useEffect(() => {
    healthCheckRef.current = setInterval(() => {
      if (isConnected) {
        ping();
        lastHeartbeatRef.current = new Date();
      }
    }, WEBSOCKET_CONFIG.options.heartbeatInterval);

    return () => {
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
    };
  }, [isConnected, ping]);

  /**
   * Handle connection state changes
   */
  useEffect(() => {
    if (enableDebug) {
      console.debug(`[WebSocket] Connection state changed: ${connectionState}`);
    }

    if (lastError && onConnectionError) {
      onConnectionError(lastError);
    }
  }, [connectionState, lastError, enableDebug, onConnectionError]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      wsDisconnect();
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current);
      }
    };
  }, [wsDisconnect]);

  const contextValue: WebSocketContextValue = {
    isConnected,
    connectionStats: {
      latency: getConnectionStats().latency,
      reconnectAttempts: getConnectionStats().reconnectAttempts,
      lastConnected: getConnectionStats().connectedSince || new Date(),
    },
    connectionHealth: updateConnectionHealth(),
    connect: wsConnect,
    disconnect: wsDisconnect,
    reconnect: wsReconnect,
    subscribe,
    unsubscribe: wsUnsubscribe,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Custom hook for accessing WebSocket context with type safety
 */
export const useWebSocketContext = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  
  return context;
};