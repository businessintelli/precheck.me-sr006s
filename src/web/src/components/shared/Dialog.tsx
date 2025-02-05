"use client";

import * as React from "react"; // @version ^18.0.0
import * as DialogPrimitive from "@radix-ui/react-dialog"; // @version ^1.0.0
import { cva, type VariantProps } from "class-variance-authority"; // @version ^0.7.0
import { useMediaQuery } from "@react-hook/media-query"; // @version ^1.1.1
import { cn } from "../../lib/utils";
import { Button } from "./Button";

// Dialog variant styles using class-variance-authority
const dialogVariants = cva(
  // Base styles with Material Design elevation and transitions
  "relative bg-background rounded-lg shadow-lg border p-6 w-full max-h-[85vh] overflow-y-auto animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  {
    variants: {
      variant: {
        default: "",
        alert: "border-destructive/20",
        confirmation: "border-primary/20",
      },
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

// Enhanced overlay styles with backdrop blur
const overlayStyles = 
  "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

// Interface for Dialog props with accessibility options
interface DialogProps
  extends React.ComponentProps<typeof DialogPrimitive.Root>,
    VariantProps<typeof dialogVariants> {
  title?: string;
  description?: string;
  className?: string;
  reducedMotion?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
}

// Enhanced Dialog component with comprehensive accessibility features
const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogProps
>(({
  variant,
  size,
  className,
  children,
  title,
  description,
  reducedMotion,
  autoFocus = true,
  restoreFocus = true,
  ...props
}, ref) => {
  // Check for reduced motion preference
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shouldReduceMotion = reducedMotion ?? prefersReducedMotion;

  // Ref for the element to restore focus to
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Store the previously focused element when dialog opens
  React.useEffect(() => {
    if (props.open && restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [props.open, restoreFocus]);

  // Restore focus when dialog closes
  React.useEffect(() => {
    if (!props.open && restoreFocus && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [props.open, restoreFocus]);

  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay 
          className={overlayStyles}
          // Remove animations if reduced motion is preferred
          style={shouldReduceMotion ? { animation: 'none' } : undefined}
        />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            dialogVariants({ variant, size }),
            shouldReduceMotion && "transition-none",
            className
          )}
          // Enhanced accessibility attributes
          aria-labelledby={title ? "dialog-title" : undefined}
          aria-describedby={description ? "dialog-description" : undefined}
          onOpenAutoFocus={(event) => {
            if (!autoFocus) {
              event.preventDefault();
            }
          }}
          // Ensure proper focus trap behavior
          onInteractOutside={(event) => {
            // Prevent interaction outside dialog when open
            if (props.open) {
              event.preventDefault();
            }
          }}
        >
          {/* Close button with enhanced accessibility */}
          <DialogPrimitive.Close 
            className="absolute right-4 top-4 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
            aria-label="Close dialog"
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
          </DialogPrimitive.Close>

          {/* Dialog header with title and description */}
          {(title || description) && (
            <div className="mb-6 space-y-2">
              {title && (
                <DialogPrimitive.Title
                  id="dialog-title"
                  className="text-lg font-semibold leading-none tracking-tight"
                >
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description
                  id="dialog-description"
                  className="text-sm text-muted-foreground"
                >
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
          )}

          {/* Dialog content */}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});

Dialog.displayName = "Dialog";

// Export named components for flexibility
export {
  Dialog,
  dialogVariants,
  type DialogProps,
};

// Re-export Radix Dialog primitives for composition
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogContent = DialogPrimitive.Content;
export const DialogHeader = DialogPrimitive.Title;
export const DialogFooter = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;