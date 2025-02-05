// @package react ^18.x
import { useEffect, useCallback, useRef } from 'react';
import { useNotificationContext } from '../providers/NotificationProvider';
import { 
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationPriority
} from '../types/notification.types';
import WebSocketService from '../services/websocket.service';

/**
 * Enum for connection state tracking
 */
export enum ConnectionState {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Interface for notification error handling
 */
interface NotificationError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Interface for hook return type with enhanced features
 */
interface UseNotificationReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  connectionState: ConnectionState;
  error: NotificationError | null;
  filterByType: (type: NotificationType) => Notification[];
  filterByPriority: (priority: NotificationPriority) => Notification[];
  retryConnection: () => Promise<void>;
}

/**
 * Enhanced custom hook for managing notifications with real-time updates
 * and comprehensive error handling
 */
export const useNotification = (): UseNotificationReturn => {
  // Get notification context
  const {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    addNotification,
    updateNotification
  } = useNotificationContext();

  // WebSocket service reference
  const wsService = useRef<WebSocketService>(WebSocketService.getInstance());
  
  // Local state references
  const connectionStateRef = useRef<ConnectionState>(ConnectionState.DISCONNECTED);
  const errorRef = useRef<NotificationError | null>(null);

  /**
   * Enhanced notification handler with priority processing
   */
  const handleNotification = useCallback((
    type: NotificationType,
    data: unknown,
    timestamp: Date,
    metadata: Record<string, unknown>
  ) => {
    try {
      const notification = data as Notification;
      
      // Handle high priority notifications immediately
      if (notification.priority === NotificationPriority.HIGH) {
        addNotification(notification);
        return;
      }

      // Group related notifications if they exist
      const existingNotification = notifications.find(
        n => n.type === notification.type && 
        n.metadata.context === notification.metadata.context
      );

      if (existingNotification) {
        updateNotification({
          ...existingNotification,
          message: notification.message,
          updated_at: timestamp
        });
      } else {
        addNotification(notification);
      }
    } catch (error) {
      const notificationError: NotificationError = {
        code: 'NOTIFICATION_PROCESSING_ERROR',
        message: 'Failed to process notification',
        details: error
      };
      errorRef.current = notificationError;
    }
  }, [notifications, addNotification, updateNotification]);

  /**
   * Connection state change handler
   */
  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    connectionStateRef.current = state;
  }, []);

  /**
   * Initialize WebSocket subscriptions and handle cleanup
   */
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        handleConnectionStateChange(ConnectionState.CONNECTING);
        await wsService.current.connect();
        handleConnectionStateChange(ConnectionState.CONNECTED);

        // Subscribe to all notification types
        Object.values(NotificationType).forEach(type => {
          wsService.current.subscribe(type, handleNotification);
        });

        errorRef.current = null;
      } catch (error) {
        handleConnectionStateChange(ConnectionState.ERROR);
        errorRef.current = {
          code: 'CONNECTION_ERROR',
          message: 'Failed to establish WebSocket connection',
          details: error
        };
      }
    };

    initializeNotifications();

    return () => {
      // Cleanup subscriptions
      Object.values(NotificationType).forEach(type => {
        wsService.current.unsubscribe(type, handleNotification);
      });
      wsService.current.disconnect();
      handleConnectionStateChange(ConnectionState.DISCONNECTED);
    };
  }, [handleNotification, handleConnectionStateChange]);

  /**
   * Filter notifications by type
   */
  const filterByType = useCallback((type: NotificationType): Notification[] => {
    return notifications.filter(notification => notification.type === type);
  }, [notifications]);

  /**
   * Filter notifications by priority
   */
  const filterByPriority = useCallback((priority: NotificationPriority): Notification[] => {
    return notifications.filter(notification => notification.priority === priority);
  }, [notifications]);

  /**
   * Retry WebSocket connection
   */
  const retryConnection = useCallback(async () => {
    try {
      handleConnectionStateChange(ConnectionState.CONNECTING);
      await wsService.current.connect();
      handleConnectionStateChange(ConnectionState.CONNECTED);
      errorRef.current = null;
    } catch (error) {
      handleConnectionStateChange(ConnectionState.ERROR);
      errorRef.current = {
        code: 'RETRY_CONNECTION_ERROR',
        message: 'Failed to reconnect WebSocket',
        details: error
      };
      throw error;
    }
  }, [handleConnectionStateChange]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearAll,
    connectionState: connectionStateRef.current,
    error: errorRef.current,
    filterByType,
    filterByPriority,
    retryConnection
  };
};

export default useNotification;