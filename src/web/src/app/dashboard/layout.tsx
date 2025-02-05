"use client";

import * as React from "react"; // @version ^18.0.0
import { redirect } from "next/navigation"; // @version ^14.0.0
import { ErrorBoundary } from "@sentry/react"; // @version ^7.0.0
import { useRoleAccess } from "@auth/core"; // @version ^0.12.0
import { useAnalytics } from "@vercel/analytics"; // @version ^1.0.0
import { useConnectionStatus } from "@vercel/core"; // @version ^1.0.0

import DashboardShell from "../../components/layout/DashboardShell";
import { useAuth } from "../../providers/AuthProvider";
import NotificationProvider from "../../providers/NotificationProvider";
import { UserRole } from "../../types/user.types";

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Enhanced dashboard layout component with security, monitoring, and role-based access control
 */
const RootLayout: React.FC<LayoutProps> = ({ children }) => {
  // Authentication and role validation
  const { user, isAuthenticated, validateSession } = useAuth();
  const { hasAccess } = useRoleAccess();
  const { track } = useAnalytics();
  const { isOnline } = useConnectionStatus();
  const [isMounted, setIsMounted] = React.useState(false);

  // Session validation on mount and periodic checks
  React.useEffect(() => {
    const validateAccess = async () => {
      if (!isAuthenticated) {
        redirect("/auth/login");
      }

      const isValid = await validateSession();
      if (!isValid) {
        redirect("/auth/login?reason=invalid_session");
      }

      // Track page view for analytics
      track("dashboard_view", {
        user_role: user?.role,
        organization_id: user?.organization_id
      });
    };

    validateAccess();
    setIsMounted(true);

    // Periodic session validation
    const interval = setInterval(validateAccess, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      clearInterval(interval);
    };
  }, [isAuthenticated, validateSession, track, user]);

  // Role-based access control
  React.useEffect(() => {
    if (user && !hasAccess(user.role)) {
      redirect("/unauthorized");
    }
  }, [user, hasAccess]);

  // Connection status monitoring
  React.useEffect(() => {
    if (!isOnline) {
      // Show offline notification or handle offline state
      console.warn("Application is offline. Some features may be unavailable.");
    }
  }, [isOnline]);

  // Error handling for the entire dashboard
  const handleError = (error: Error) => {
    console.error("Dashboard error:", error);
    // Log to error tracking service
    track("dashboard_error", {
      error_message: error.message,
      user_role: user?.role,
      organization_id: user?.organization_id
    });
  };

  if (!isMounted) {
    return null;
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">
              Something went wrong
            </h1>
            <p className="mt-2 text-gray-600">
              Please refresh the page or contact support
            </p>
          </div>
        </div>
      }
      onError={handleError}
    >
      <NotificationProvider
        maxNotifications={100}
        retryAttempts={3}
        debounceMs={300}
      >
        <DashboardShell
          role={user?.role as UserRole}
          className={!isOnline ? "opacity-75 pointer-events-none" : ""}
        >
          {/* Skip to main content link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:p-4"
          >
            Skip to main content
          </a>

          {/* Main content area */}
          <main
            id="main-content"
            className="min-h-screen bg-background"
            role="main"
            aria-label="Dashboard content"
          >
            {children}
          </main>

          {/* Offline indicator */}
          {!isOnline && (
            <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-md shadow-lg">
              You are offline. Some features may be unavailable.
            </div>
          )}
        </DashboardShell>
      </NotificationProvider>
    </ErrorBoundary>
  );
};

export default RootLayout;