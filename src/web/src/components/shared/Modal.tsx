"use client";

import * as React from "react"; // @version ^18.0.0
import { cva, type VariantProps } from "class-variance-authority"; // @version ^0.7.0
import { cn } from "../../lib/utils";
import { Dialog } from "./Dialog";

// Modal variant styles with Material Design elevation and spacing
const modalVariants = cva(
  "relative bg-background rounded-lg shadow-lg overflow-hidden transition-transform",
  {
    variants: {
      variant: {
        default: "border border-border/50",
        fullscreen: "fixed inset-0 border-none rounded-none",
        slideOver: "fixed inset-y-0 right-0 border-l h-full rounded-none",
      },
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// Interface for modal-specific behavior props
interface ModalBehaviorProps {
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEsc?: boolean;
  motionPreference?: boolean;
  rtl?: boolean;
  stackIndex?: number;
  lazyLoad?: boolean;
}

// Combined props interface
interface ModalProps
  extends React.ComponentProps<typeof Dialog>,
    VariantProps<typeof modalVariants>,
    ModalBehaviorProps {}

const Modal = React.forwardRef<
  React.ElementRef<typeof Dialog>,
  ModalProps
>(({
  variant,
  size,
  className,
  children,
  title,
  description,
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnEsc = true,
  motionPreference = true,
  rtl = false,
  stackIndex = 0,
  lazyLoad = false,
  ...props
}, ref) => {
  // Track if content has been loaded for lazy loading
  const [contentLoaded, setContentLoaded] = React.useState(!lazyLoad);

  // Load content when modal opens if lazy loading is enabled
  React.useEffect(() => {
    if (lazyLoad && props.open && !contentLoaded) {
      setContentLoaded(true);
    }
  }, [lazyLoad, props.open, contentLoaded]);

  // Handle RTL layout adjustments
  const rtlStyles = rtl ? {
    direction: "rtl" as const,
    right: "auto",
    left: variant === "slideOver" ? 0 : undefined,
  } : {};

  // Calculate z-index for stacking contexts
  const zIndex = 50 + stackIndex * 10;

  return (
    <Dialog
      ref={ref}
      {...props}
      className={cn(
        modalVariants({ variant, size }),
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        variant === "default" && "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        variant === "fullscreen" && "data-[state=open]:fade-in-0",
        variant === "slideOver" && "data-[state=open]:slide-in-from-right",
        className
      )}
      style={{
        ...rtlStyles,
        zIndex,
      }}
      // Enhanced accessibility props
      aria-modal="true"
      role="dialog"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
      // Behavior configuration
      onEscapeKeyDown={(event) => {
        if (!closeOnEsc) {
          event.preventDefault();
        }
      }}
      onInteractOutside={(event) => {
        if (!closeOnOutsideClick) {
          event.preventDefault();
        }
      }}
      // Reduced motion support
      reducedMotion={!motionPreference}
      title={title}
      description={description}
    >
      {/* Only render content if not lazy loading or if content should be loaded */}
      {(!lazyLoad || contentLoaded) && (
        <div className="relative">
          {/* Close button */}
          {showCloseButton && (
            <button
              className={cn(
                "absolute top-4 opacity-70 ring-offset-background transition-opacity hover:opacity-100",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none",
                rtl ? "left-4" : "right-4"
              )}
              onClick={() => props.onOpenChange?.(false)}
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* Modal content */}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </Dialog>
  );
});

Modal.displayName = "Modal";

export { Modal, modalVariants, type ModalProps };