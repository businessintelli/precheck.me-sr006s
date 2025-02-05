"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot"; // @version ^1.0.2
import { cva, type VariantProps } from "class-variance-authority"; // @version ^0.7.0
import { Loader2 } from "lucide-react"; // @version ^0.3.0
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  // Base styles with focus-visible and disabled states
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-10 px-4 py-2",
        lg: "h-11 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Use Radix Slot for composition
    const Comp = asChild ? Slot : "button";
    
    // Combine disabled state with loading state
    const isDisabled = disabled || isLoading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
        // Enhanced accessibility attributes
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        data-state={isLoading ? "loading" : isDisabled ? "disabled" : "idle"}
        // Prevent double-click during loading
        onClick={isLoading ? undefined : props.onClick}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading, please wait</span>
            {/* Preserve layout by keeping children visible but with reduced opacity */}
            <span className="opacity-60">{children}</span>
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

// Set display name for debugging
Button.displayName = "Button";

export { Button, buttonVariants };