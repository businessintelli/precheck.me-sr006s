import React, { useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion'; // v10.0.0
import { cn } from '../../lib/utils';

// Toast variant configurations with accessibility and styling
const TOAST_VARIANTS = {
  success: {
    icon: 'CheckCircle',
    className: 'bg-green-50 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    role: 'status',
    ariaLive: 'polite'
  },
  error: {
    icon: 'XCircle',
    className: 'bg-red-50 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    role: 'alert',
    ariaLive: 'assertive'
  },
  warning: {
    icon: 'AlertTriangle',
    className: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    role: 'alert',
    ariaLive: 'polite'
  },
  info: {
    icon: 'Info',
    className: 'bg-blue-50 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    role: 'status',
    ariaLive: 'polite'
  }
} as const;

// Animation configuration
const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95, y: -20 }
};

const DEFAULT_DURATION = 5000;

interface ToastProps {
  id: string;
  title: string;
  message: string;
  type: keyof typeof TOAST_VARIANTS;
  duration?: number;
  onClose: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  rtl?: boolean;
  role?: 'status' | 'alert';
}

const Toast: React.FC<ToastProps> = React.memo(({
  id,
  title,
  message,
  type,
  duration = DEFAULT_DURATION,
  onClose,
  position = 'top-right',
  rtl = false,
  role
}) => {
  const toastRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const variant = TOAST_VARIANTS[type];

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Set up auto-dismiss timer
  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(onClose, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, onClose]);

  // Set up keyboard event listeners
  useEffect(() => {
    const element = toastRef.current;
    if (element) {
      element.addEventListener('keydown', handleKeyDown);
      // Focus management
      element.focus();
    }

    return () => {
      if (element) {
        element.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [handleKeyDown]);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={toastRef}
        role={role || variant.role}
        aria-live={variant.ariaLive}
        aria-atomic="true"
        tabIndex={0}
        className={cn(
          'fixed z-50 flex w-full max-w-sm overflow-hidden rounded-lg shadow-lg',
          variant.className,
          positionClasses[position],
          rtl ? 'rtl' : 'ltr'
        )}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={ANIMATION_VARIANTS}
        transition={{ duration: 0.2 }}
        onMouseEnter={() => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
        }}
        onMouseLeave={() => {
          if (duration > 0) {
            timerRef.current = setTimeout(onClose, duration);
          }
        }}
      >
        <div className="flex w-full items-start p-4">
          <div className="flex-shrink-0">
            <span className="sr-only">{type} notification</span>
            {/* Icon component would be rendered here */}
            <div className={cn(
              'h-5 w-5',
              type === 'success' && 'text-green-500',
              type === 'error' && 'text-red-500',
              type === 'warning' && 'text-yellow-500',
              type === 'info' && 'text-blue-500'
            )} />
          </div>
          <div className={cn('ml-3 w-0 flex-1', rtl && 'ml-0 mr-3')}>
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-sm opacity-90">{message}</p>
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              type="button"
              className={cn(
                'inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2',
                'text-gray-400 hover:text-gray-500 focus:ring-gray-500'
              )}
              onClick={onClose}
              aria-label="Close notification"
            >
              <span className="sr-only">Close</span>
              {/* Close icon would be rendered here */}
              <div className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

Toast.displayName = 'Toast';

export default Toast;