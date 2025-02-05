"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs"; // @version ^1.0.0
import { cn } from "../../lib/utils";

// Interface for individual tab configuration
interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// Props interface with comprehensive configuration options
interface TabsProps {
  defaultValue: string;
  tabs: TabItem[];
  orientation?: "horizontal" | "vertical";
  className?: string;
  onValueChange?: (value: string) => void;
  loading?: boolean;
  animate?: boolean;
  dir?: "ltr" | "rtl";
}

// Styles following Material Design 3.0 principles
const TAB_TRIGGER_STYLES = 
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium " +
  "ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 " +
  "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm " +
  "data-[orientation=vertical]:justify-start data-[orientation=vertical]:w-full rtl:text-right " +
  "gap-2 hover:bg-muted/50";

const TAB_CONTENT_STYLES = 
  "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "transition-opacity duration-200 data-[state=inactive]:opacity-0 data-[state=active]:opacity-100";

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({
  defaultValue,
  tabs,
  orientation = "horizontal",
  className,
  onValueChange,
  loading = false,
  animate = true,
  dir = "ltr",
}, ref) => {
  // Error boundary for graceful error handling
  const [error, setError] = React.useState<Error | null>(null);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const tabList = event.currentTarget;
    const triggers = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const currentIndex = triggers.indexOf(document.activeElement as Element);

    const handleNavigation = (newIndex: number) => {
      if (triggers[newIndex]) {
        (triggers[newIndex] as HTMLElement).focus();
      }
    };

    switch (event.key) {
      case "ArrowRight":
        handleNavigation(dir === "rtl" ? currentIndex - 1 : currentIndex + 1);
        break;
      case "ArrowLeft":
        handleNavigation(dir === "rtl" ? currentIndex + 1 : currentIndex - 1);
        break;
      case "ArrowDown":
        if (orientation === "vertical") handleNavigation(currentIndex + 1);
        break;
      case "ArrowUp":
        if (orientation === "vertical") handleNavigation(currentIndex - 1);
        break;
      case "Home":
        handleNavigation(0);
        break;
      case "End":
        handleNavigation(triggers.length - 1);
        break;
    }
  };

  // Error boundary fallback
  if (error) {
    return (
      <div role="alert" className="text-destructive p-4 rounded-md bg-destructive/10">
        <h2 className="font-semibold">Error Loading Tabs</h2>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <TabsPrimitive.Root
      ref={ref}
      defaultValue={defaultValue}
      orientation={orientation}
      onValueChange={onValueChange}
      dir={dir}
      className={cn(
        "w-full",
        orientation === "vertical" && "flex space-x-4",
        className
      )}
    >
      <TabsPrimitive.List
        className={cn(
          "flex h-10 items-center gap-1 border-b",
          orientation === "vertical" && "flex-col h-auto border-b-0 border-r w-48",
          loading && "opacity-50 pointer-events-none"
        )}
        onKeyDown={handleKeyDown}
        aria-orientation={orientation}
      >
        {tabs.map(({ value, label, icon, disabled }) => (
          <TabsPrimitive.Trigger
            key={value}
            value={value}
            disabled={disabled || loading}
            className={cn(TAB_TRIGGER_STYLES)}
            aria-label={label}
          >
            {icon && <span className="w-4 h-4">{icon}</span>}
            <span>{label}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <div className={cn("flex-1", orientation === "vertical" && "ml-4")}>
        {tabs.map(({ value, content }) => (
          <TabsPrimitive.Content
            key={value}
            value={value}
            className={cn(
              TAB_CONTENT_STYLES,
              !animate && "transition-none"
            )}
          >
            {content}
          </TabsPrimitive.Content>
        ))}
      </div>
    </TabsPrimitive.Root>
  );
});

// Display name for debugging and dev tools
Tabs.displayName = "Tabs";

export default Tabs;