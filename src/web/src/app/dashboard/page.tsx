"use client";

import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import DashboardShell from "../../components/layout/DashboardShell";
import CheckList from "../../components/background-checks/CheckList";
import InterviewList from "../../components/interviews/InterviewList";
import useAuth from "../../hooks/useAuth";
import { useBackgroundCheck } from "../../hooks/useBackgroundCheck";
import { BackgroundCheckStatus } from "../../types/background-check.types";
import { cn } from "../../lib/utils";

/**
 * Main dashboard page component with real-time updates and role-based access
 */
const DashboardPage: React.FC = () => {
  // Authentication and user context
  const { user, isAuthenticated } = useAuth();

  // Background check data with real-time updates
  const {
    backgroundCheck: checks,
    isLoading: isChecksLoading,
    error: checksError,
    updateBackgroundCheck,
    isRealTimeEnabled,
    setIsRealTimeEnabled
  } = useBackgroundCheck();

  // Handle background check status updates
  const handleStatusUpdate = React.useCallback(
    async (checkId: string, status: BackgroundCheckStatus) => {
      try {
        await updateBackgroundCheck(checkId, status);
      } catch (error) {
        console.error("Failed to update check status:", error);
      }
    },
    [updateBackgroundCheck]
  );

  // Early return for unauthenticated users
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Welcome Section */}
        <section className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user.profile.first_name}
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your background checks and interviews.
          </p>
        </section>

        {/* Background Checks Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">
              Active Background Checks
            </h2>
            <div className="flex items-center space-x-2">
              <label className="text-sm text-muted-foreground">
                Real-time updates
              </label>
              <input
                type="checkbox"
                checked={isRealTimeEnabled}
                onChange={(e) => setIsRealTimeEnabled(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>
          </div>

          <ErrorBoundary
            fallback={
              <div className="p-4 text-red-600 bg-red-50 rounded-lg">
                Error loading background checks. Please try again later.
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="animate-pulse space-y-4">
                  <div className="h-12 bg-gray-200 rounded" />
                  <div className="h-12 bg-gray-200 rounded" />
                  <div className="h-12 bg-gray-200 rounded" />
                </div>
              }
            >
              <div className={cn("rounded-lg border bg-card")}>
                <CheckList
                  organizationId={user.organization_id}
                  onStatusChange={handleStatusUpdate}
                  className="min-h-[300px]"
                  virtualScrolling
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        </section>

        {/* Interviews Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Recent Interviews
          </h2>

          <ErrorBoundary
            fallback={
              <div className="p-4 text-red-600 bg-red-50 rounded-lg">
                Error loading interviews. Please try again later.
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="animate-pulse space-y-4">
                  <div className="h-12 bg-gray-200 rounded" />
                  <div className="h-12 bg-gray-200 rounded" />
                </div>
              }
            >
              <div className={cn("rounded-lg border bg-card")}>
                <InterviewList
                  interviews={[]} // Replace with actual interview data hook
                  isLoading={false}
                  onSort={(column, direction) => {
                    // Implement interview sorting
                  }}
                  onFilter={(filters) => {
                    // Implement interview filtering
                  }}
                  onStatusUpdate={(id, status) => {
                    // Implement interview status updates
                  }}
                  className="min-h-[300px]"
                />
              </div>
            </Suspense>
          </ErrorBoundary>
        </section>
      </div>
    </DashboardShell>
  );
};

export default DashboardPage;