import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconBell, IconX } from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  NotificationType, 
  NotificationPriority 
} from '../../types/notification.types';
import { useNotificationContext } from '../../providers/NotificationProvider';

interface NotificationProps {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  created_at: Date;
  onDismiss: () => void;
  isExpanded?: boolean;
  autoHideDuration?: number;
}

const getNotificationStyles = (
  type: NotificationType,
  priority: NotificationPriority,
  isDarkMode: boolean
): string => {
  const baseStyles = cn(
    'relative flex items-start gap-4 rounded-lg p-4 shadow-lg transition-all',
    'animate-in slide-in-from-right',
    isDarkMode ? 'dark' : ''
  );

  const priorityStyles = {
    [NotificationPriority.HIGH]: cn(
      'border-l-4 border-red-500',
      isDarkMode ? 'bg-red-900/10' : 'bg-red-50'
    ),
    [NotificationPriority.MEDIUM]: cn(
      'border-l-4 border-yellow-500',
      isDarkMode ? 'bg-yellow-900/10' : 'bg-yellow-50'
    ),
    [NotificationPriority.LOW]: cn(
      'border-l-4 border-blue-500',
      isDarkMode ? 'bg-blue-900/10' : 'bg-blue-50'
    ),
  };

  const typeStyles = {
    [NotificationType.CHECK_STATUS_UPDATE]: 'max-w-md',
    [NotificationType.DOCUMENT_VERIFIED]: 'max-w-md',
    [NotificationType.INTERVIEW_READY]: 'max-w-lg',
    [NotificationType.SYSTEM_ALERT]: 'max-w-md',
  };

  return cn(
    baseStyles,
    priorityStyles[priority],
    typeStyles[type]
  );
};

const formatTimestamp = (timestamp: Date, locale: string = 'en-US'): string => {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }).format(timestamp);
};

const Notification = React.memo<NotificationProps>(({
  id,
  type,
  title,
  message,
  priority,
  created_at,
  onDismiss,
  isExpanded = false,
  autoHideDuration = 5000
}) => {
  const [expanded, setExpanded] = React.useState(isExpanded);
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const dismissTimeout = React.useRef<NodeJS.Timeout>();

  // Check system dark mode preference
  React.useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handler);
    return () => darkModeQuery.removeEventListener('change', handler);
  }, []);

  // Auto-dismiss logic
  React.useEffect(() => {
    if (autoHideDuration && priority !== NotificationPriority.HIGH) {
      dismissTimeout.current = setTimeout(onDismiss, autoHideDuration);
    }
    return () => {
      if (dismissTimeout.current) {
        clearTimeout(dismissTimeout.current);
      }
    };
  }, [autoHideDuration, onDismiss, priority]);

  const handleExpand = () => {
    setExpanded(!expanded);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss();
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className={getNotificationStyles(type, priority, isDarkMode)}
        role="alert"
        aria-live={priority === NotificationPriority.HIGH ? 'assertive' : 'polite'}
        onClick={handleExpand}
      >
        <div className="flex-shrink-0">
          <IconBell 
            className={cn(
              'h-5 w-5',
              priority === NotificationPriority.HIGH ? 'text-red-500' :
              priority === NotificationPriority.MEDIUM ? 'text-yellow-500' : 'text-blue-500'
            )}
            aria-hidden="true"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <h3 className={cn(
              'text-sm font-medium',
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            )}>
              {title}
            </h3>
            <button
              onClick={handleDismiss}
              className={cn(
                'ml-4 inline-flex text-gray-400 hover:text-gray-500 focus:outline-none',
                'focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-md'
              )}
              aria-label="Dismiss notification"
            >
              <IconX className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <motion.div
            initial={false}
            animate={{ height: expanded ? 'auto' : '1.5rem' }}
            className="mt-1 overflow-hidden"
          >
            <p className={cn(
              'text-sm whitespace-pre-wrap',
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            )}>
              {message}
            </p>
          </motion.div>

          <div className="mt-2 text-xs text-gray-500">
            {formatTimestamp(created_at)}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

Notification.displayName = 'Notification';

export default Notification;