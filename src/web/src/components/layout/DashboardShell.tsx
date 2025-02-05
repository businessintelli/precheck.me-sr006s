"use client";

import * as React from "react"; // @version ^18.0.0
import { useMediaQuery } from "@react-hook/media-query"; // @version ^1.1.1
import { useTheme } from "next-themes"; // @version ^0.2.1

import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { cn } from "../../lib/utils";
import { UserRole } from "../../types/user.types";
import { UI_CONSTANTS } from "../../lib/constants";

interface DashboardShellProps {
  children: React.ReactNode;
  className?: string;
  role?: UserRole;
}

const SIDEBAR_STORAGE_KEY = "dashboard_sidebar_collapsed";
const SIDEBAR_WIDTH = 256; // Material Design 3.0 standard drawer width
const SIDEBAR_COLLAPSED_WIDTH = 70;

const useSidebarState = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : false;
    }
    return false;
  });

  const toggleSidebar = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const newState = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  return { isCollapsed, toggleSidebar };
};

export const DashboardShell: React.FC<DashboardShellProps> = ({
  children,
  className,
  role
}) => {
  const { isCollapsed, toggleSidebar } = useSidebarState();
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = React.useState(false);

  // Responsive breakpoints from UI constants
  const isMobile = useMediaQuery(
    `(max-width: ${UI_CONSTANTS.BREAKPOINTS.mobile}px)`
  );
  const isTablet = useMediaQuery(
    `(max-width: ${UI_CONSTANTS.BREAKPOINTS.tablet}px)`
  );

  // Force sidebar collapse on mobile
  React.useEffect(() => {
    if (isMobile && !isCollapsed) {
      toggleSidebar();
    }
  }, [isMobile, isCollapsed, toggleSidebar]);

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // Handle hydration
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative min-h-screen bg-background",
        "flex flex-col",
        className
      )}
    >
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4"
      >
        Skip to main content
      </a>

      <Header className="z-40" />

      <div className="flex-1 flex">
        {/* Sidebar with animation */}
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={toggleSidebar}
          className={cn(
            "transition-all duration-300 ease-in-out",
            isMobile && "absolute"
          )}
        />

        {/* Main content area with dynamic spacing */}
        <main
          id="main-content"
          className={cn(
            "flex-1 flex flex-col",
            "transition-all duration-300 ease-in-out",
            !isMobile &&
              `ml-[${isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px]`
          )}
          style={{
            marginLeft: isMobile
              ? 0
              : isCollapsed
              ? SIDEBAR_COLLAPSED_WIDTH
              : SIDEBAR_WIDTH
          }}
        >
          {/* Content wrapper with responsive padding */}
          <div
            className={cn(
              "flex-1 container",
              "px-4 py-6",
              "md:px-6 md:py-8",
              "lg:px-8 lg:py-10"
            )}
          >
            {children}
          </div>

          <Footer />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobile && !isCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Theme toggle for system preference changes */}
      <div className="hidden">
        <button
          aria-hidden="true"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      </div>
    </div>
  );
};

export default DashboardShell;