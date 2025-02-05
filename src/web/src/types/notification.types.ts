// @package zod ^3.22.0
import { z } from 'zod';
import { User } from './user.types';

/**
 * Enum representing different types of notifications in the system
 * @enum {string}
 */
export enum NotificationType {
  CHECK_STATUS_UPDATE = 'CHECK_STATUS_UPDATE',
  DOCUMENT_VERIFIED = 'DOCUMENT_VERIFIED',
  INTERVIEW_READY = 'INTERVIEW_READY',
  USER_ACTIVITY = 'USER_ACTIVITY',
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Enum representing notification priority levels
 * @enum {string}
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

/**
 * Enum representing notification read status
 * @enum {string}
 */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Interface representing notification metadata
 */
interface NotificationMetadata {
  source: string;
  context?: string;
  tags?: string[];
}

/**
 * Enhanced interface for notification entity with comprehensive tracking
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  recipient_id: string;
  data: Record<string, unknown>;
  metadata: NotificationMetadata;
  created_at: Date;
  read_at: Date | null;
  expires_at: Date | null;
}

/**
 * Interface for user notification preferences
 */
export interface NotificationPreferences {
  email_enabled: boolean;
  push_enabled: boolean;
  types: NotificationType[];
}

/**
 * Enhanced interface for WebSocket notification events with error handling
 */
export interface WebSocketNotification {
  event: NotificationType;
  data: Notification;
  timestamp: Date;
  status: {
    code: number;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Zod schema for notification metadata validation
 */
const notificationMetadataSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  context: z.string().optional(),
  tags: z.array(z.string()).optional()
});

/**
 * Enhanced Zod validation schema for notification data with strict validation rules
 */
export const notificationSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
  type: z.nativeEnum(NotificationType, {
    errorMap: () => ({ message: 'Invalid notification type' })
  }),
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title exceeds maximum length'),
  message: z.string()
    .min(1, 'Message is required')
    .max(500, 'Message exceeds maximum length'),
  priority: z.nativeEnum(NotificationPriority, {
    errorMap: () => ({ message: 'Invalid priority level' })
  }),
  status: z.nativeEnum(NotificationStatus, {
    errorMap: () => ({ message: 'Invalid notification status' })
  }),
  recipient_id: z.string().uuid('Invalid recipient ID'),
  data: z.record(z.string(), z.unknown()),
  metadata: notificationMetadataSchema,
  created_at: z.date(),
  read_at: z.date().nullable(),
  expires_at: z.date().nullable()
});

/**
 * Type guard to check if a value is a valid NotificationType
 */
export const isNotificationType = (value: unknown): value is NotificationType => {
  return Object.values(NotificationType).includes(value as NotificationType);
};

/**
 * Type guard to check if a value is a valid NotificationPriority
 */
export const isNotificationPriority = (value: unknown): value is NotificationPriority => {
  return Object.values(NotificationPriority).includes(value as NotificationPriority);
};

/**
 * Type guard to check if a value is a valid NotificationStatus
 */
export const isNotificationStatus = (value: unknown): value is NotificationStatus => {
  return Object.values(NotificationStatus).includes(value as NotificationStatus);
};

/**
 * Type for creating a new notification
 */
export type CreateNotificationPayload = Omit<Notification, 'id' | 'created_at' | 'read_at' | 'status'>;

/**
 * Type for updating an existing notification
 */
export type UpdateNotificationPayload = Partial<Omit<Notification, 'id' | 'created_at' | 'recipient_id' | 'type'>>;