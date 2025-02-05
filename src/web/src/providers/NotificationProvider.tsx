// @package lodash ^4.17.21
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { 
  Notification, 
  NotificationType, 
  NotificationStatus,
  NotificationPriority,
  notificationSchema
} from '../types/notification.types';
import WebSocketService from '../services/websocket.service';

/**
 * Enum for WebSocket connection status tracking
 */
enum WebSocketConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR'
}

/**
 * Enhanced interface for notification context state
 */
interface NotificationContextState {
  notifications: Notification[];
  unreadCount: number;
  connectionStatus: WebSocketConnectionStatus;
  error: Error | null;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  addNotification: (notification: Notification) => void;
  filterNotifications: (type?: NotificationType, status?: NotificationStatus) => Notification[];
  retryConnection: () => Promise<void>;
}

/**
 * Props interface for NotificationProvider component
 */
interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
  retryAttempts?: number;
  debounceMs?: number;
}

// Create context with undefined initial value and type safety
const NotificationContext = createContext<NotificationContextState | undefined>(undefined);

// Constants
const DEFAULT_MAX_NOTIFICATIONS = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Enhanced NotificationProvider component with improved reliability and error handling
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = DEFAULT_MAX_NOTIFICATIONS,
  retryAttempts = DEFAULT_RETRY_ATTEMPTS,
  debounceMs = DEFAULT_DEBOUNCE_MS
}) => {
  // State management
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>(
    WebSocketConnectionStatus.DISCONNECTED
  );
  const [error, setError] = useState<Error | null>(null);
  const wsService = useRef<WebSocketService>(WebSocketService.getInstance());
  const offlineQueue = useRef<Notification[]>([]);

  // Calculate unread count
  const unreadCount = notifications.filter(
    n => n.status === NotificationStatus.UNREAD
  ).length;

  /**
   * Enhanced notification handler with validation and prioritization
   */
  const handleNotification = useCallback((
    type: NotificationType,
    data: unknown,
    timestamp: Date
  ) => {
    try {
      const notification = data as Notification;
      const validatedNotification = notificationSchema.parse(notification);

      setNotifications(prev => {
        // Sort by priority and timestamp
        const updated = [...prev, validatedNotification]
          .sort((a, b) => {
            if (a.priority !== b.priority) {
              return a.priority === NotificationPriority.HIGH ? -1 : 1;
            }
            return b.created_at.getTime() - a.created_at.getTime();
          })
          .slice(0, maxNotifications);

        // Persist to localStorage
        localStorage.setItem('notifications', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('Invalid notification received:', err);
      setError(err instanceof Error ? err : new Error('Invalid notification format'));
    }
  }, [maxNotifications]);

  /**
   * Debounced notification handler for performance
   */
  const debouncedHandleNotification = useCallback(
    debounce(handleNotification, debounceMs),
    [handleNotification, debounceMs]
  );

  /**
   * Initialize WebSocket connection and handlers
   */
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        setConnectionStatus(WebSocketConnectionStatus.CONNECTING);
        await wsService.current.connect();
        setConnectionStatus(WebSocketConnectionStatus.CONNECTED);

        // Subscribe to all notification types
        Object.values(NotificationType).forEach(type => {
          wsService.current.subscribe(type, debouncedHandleNotification);
        });

        // Process offline queue if any
        while (offlineQueue.current.length > 0) {
          const notification = offlineQueue.current.shift();
          if (notification) {
            handleNotification(notification.type, notification, new Date());
          }
        }
      } catch (err) {
        setConnectionStatus(WebSocketConnectionStatus.ERROR);
        setError(err instanceof Error ? err : new Error('WebSocket connection failed'));
      }
    };

    initializeWebSocket();

    // Load persisted notifications
    const savedNotifications = localStorage.getItem('notifications');
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications) as Notification[];
        setNotifications(parsed);
      } catch (err) {
        console.error('Error loading saved notifications:', err);
      }
    }

    return () => {
      wsService.current.disconnect();
      Object.values(NotificationType).forEach(type => {
        wsService.current.unsubscribe(type, debouncedHandleNotification);
      });
    };
  }, [debouncedHandleNotification]);

  /**
   * Mark notification as read with persistence
   */
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(notification =>
        notification.id === id
          ? { ...notification, status: NotificationStatus.READ, read_at: new Date() }
          : notification
      );
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Clear all notifications with persistence
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem('notifications');
  }, []);

  /**
   * Add new notification with offline support
   */
  const addNotification = useCallback((notification: Notification) => {
    if (connectionStatus === WebSocketConnectionStatus.CONNECTED) {
      handleNotification(notification.type, notification, new Date());
    } else {
      offlineQueue.current.push(notification);
    }
  }, [connectionStatus, handleNotification]);

  /**
   * Filter notifications by type and status
   */
  const filterNotifications = useCallback((
    type?: NotificationType,
    status?: NotificationStatus
  ) => {
    return notifications.filter(notification => 
      (!type || notification.type === type) &&
      (!status || notification.status === status)
    );
  }, [notifications]);

  /**
   * Retry WebSocket connection
   */
  const retryConnection = useCallback(async () => {
    let attempts = 0;
    while (attempts < retryAttempts) {
      try {
        setConnectionStatus(WebSocketConnectionStatus.CONNECTING);
        await wsService.current.connect();
        setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
        setError(null);
        return;
      } catch (err) {
        attempts++;
        if (attempts === retryAttempts) {
          setConnectionStatus(WebSocketConnectionStatus.ERROR);
          setError(err instanceof Error ? err : new Error('Max retry attempts exceeded'));
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }, [retryAttempts]);

  const contextValue: NotificationContextState = {
    notifications,
    unreadCount,
    connectionStatus,
    error,
    markAsRead,
    clearAll,
    addNotification,
    filterNotifications,
    retryConnection
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Custom hook for accessing notification context with type safety
 */
export const useNotificationContext = (): NotificationContextState => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;