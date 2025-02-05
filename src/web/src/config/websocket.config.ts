/**
 * WebSocket configuration for Precheck.me platform
 * Implements real-time communication with enhanced reliability and monitoring
 * @package ws ^8.14.2
 */

import { NotificationType } from '../types/notification.types';

/**
 * Interface for WebSocket connection configuration options
 */
export interface WebSocketOptions {
  reconnect: boolean;
  reconnectInterval: number;
  maxRetries: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  validateOrigin: boolean;
}

/**
 * Environment-specific WebSocket URL with fallback
 */
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws';

/**
 * Connection and retry configuration constants
 */
const RETRY_DELAY = 1000; // 1 second between retry attempts
const MAX_RETRIES = 5; // Maximum number of reconnection attempts
const HEARTBEAT_INTERVAL = 30000; // 30 seconds between heartbeats
const CONNECTION_TIMEOUT = 5000; // 5 seconds connection timeout

/**
 * WebSocket configuration object with enhanced security and reliability options
 */
export const WEBSOCKET_CONFIG = {
  url: WEBSOCKET_URL,
  options: {
    reconnect: true,
    reconnectInterval: RETRY_DELAY,
    maxRetries: MAX_RETRIES,
    heartbeatInterval: HEARTBEAT_INTERVAL,
    connectionTimeout: CONNECTION_TIMEOUT,
    validateOrigin: true
  } as WebSocketOptions
};

/**
 * Comprehensive WebSocket event type constants including system events
 */
export const WS_EVENTS = {
  // Business events mapped from NotificationType
  CHECK_STATUS_UPDATE: 'check.status_update',
  INTERVIEW_READY: 'interview.ready',
  DOCUMENT_VERIFIED: 'document.verified',
  USER_ACTIVITY: 'user.activity',

  // Connection management events
  CONNECTION_ERROR: 'connection.error',
  CONNECTION_CLOSED: 'connection.closed',
  HEARTBEAT: 'heartbeat',
  RECONNECTING: 'connection.reconnecting',
  MAX_RETRIES_EXCEEDED: 'connection.max_retries_exceeded'
} as const;

/**
 * Type guard to validate WebSocket event types
 */
export const isValidWebSocketEvent = (event: string): event is keyof typeof WS_EVENTS => {
  return Object.values(WS_EVENTS).includes(event as typeof WS_EVENTS[keyof typeof WS_EVENTS]);
};

/**
 * Interface for WebSocket message payload with error handling
 */
export interface WebSocketMessage<T = unknown> {
  event: keyof typeof WS_EVENTS;
  data: T;
  timestamp: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Type mapping for event-specific payload types
 */
export type WebSocketEventPayloads = {
  [WS_EVENTS.CHECK_STATUS_UPDATE]: {
    checkId: string;
    status: string;
    updatedAt: string;
  };
  [WS_EVENTS.INTERVIEW_READY]: {
    interviewId: string;
    candidateId: string;
    startTime: string;
  };
  [WS_EVENTS.DOCUMENT_VERIFIED]: {
    documentId: string;
    verified: boolean;
    verificationDetails?: Record<string, unknown>;
  };
  [WS_EVENTS.USER_ACTIVITY]: {
    userId: string;
    activity: string;
    timestamp: string;
  };
  [WS_EVENTS.CONNECTION_ERROR]: {
    code: string;
    message: string;
    attempt?: number;
  };
  [WS_EVENTS.CONNECTION_CLOSED]: {
    code: number;
    reason: string;
    wasClean: boolean;
  };
  [WS_EVENTS.HEARTBEAT]: {
    timestamp: string;
    connectionId: string;
  };
  [WS_EVENTS.RECONNECTING]: {
    attempt: number;
    maxAttempts: number;
    nextRetry: number;
  };
  [WS_EVENTS.MAX_RETRIES_EXCEEDED]: {
    attempts: number;
    lastError?: string;
  };
};

/**
 * Helper type for WebSocket event handlers with typed payloads
 */
export type WebSocketEventHandler<T extends keyof WebSocketEventPayloads> = (
  payload: WebSocketEventPayloads[T]
) => void | Promise<void>;

/**
 * Utility type for mapping event names to their respective payload types
 */
export type WebSocketEventMap = {
  [K in keyof WebSocketEventPayloads]: WebSocketEventHandler<K>;
};