"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Analytics } from "@segment/analytics-next";

import DashboardShell from "../../../components/layout/DashboardShell";
import PageHeader from "../../../components/layout/PageHeader";
import CheckList from "../../../components/background-checks/CheckList";
import { Button } from "../../../components/shared/Button";
import { Dropdown } from "../../../components/shared/Dropdown";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useAuth } from "../../../hooks/useAuth";
import { BackgroundCheckStatus } from "../../../types/background-check.types";
import { NotificationType } from "../../../types/notification.types";
import Link from "next/link";

// Initialize analytics
const analytics = new Analytics({
  writeKey: process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY || ""
});

// Filter options for background check status
const STATUS_FILTER_OPTIONS = Object.values(BackgroundCheckStatus).map(status => ({
  value: status,
  label: status.replace(/_/g, " ").toLowerCase()
}));

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-6 text-center">
    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
      Something went wrong
    </h3>
    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
      {error.message}
    </p>
    <Button onClick={resetErrorBoundary} variant="outline">
      Try again
    </Button>
  </div>
);

const BackgroundChecksPage = () => {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatuses, setSelectedStatuses] = useState<BackgroundCheckStatus[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);

  // Initialize WebSocket connection
  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  // Track page view
  useEffect(() => {
    analytics.page("Background Checks Dashboard", {
      organization_id: organization?.id,
      user_role: user?.role
    });
  }, [organization?.id, user?.role]);

  // Handle real-time status updates
  const handleStatusUpdate = useCallback((data: any) => {
    if (data.organizationId === organization?.id) {
      queryClient.invalidateQueries(["backgroundChecks"]);
    }
  }, [organization?.id, queryClient]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    subscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    return () => {
      unsubscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    };
  }, [subscribe, unsubscribe, handleStatusUpdate]);

  // Handle status filter changes
  const handleStatusFilterChange = (values: string[]) => {
    setSelectedStatuses(values as BackgroundCheckStatus[]);
    analytics.track("Background Checks Filtered", {
      statuses: values,
      organization_id: organization?.id
    });
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <DashboardShell>
        <PageHeader
          heading="Background Checks"
          description="Manage and track background verification processes"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Background Checks", href: "/dashboard/background-checks", current: true }
          ]}
          actions={
            <div className="flex items-center gap-4">
              <Dropdown
                options={STATUS_FILTER_OPTIONS}
                value={selectedStatuses}
                onChange={handleStatusFilterChange}
                placeholder="Filter by status"
                multiple
                searchable
              />
              <Link href="/dashboard/background-checks/new">
                <Button>
                  New Background Check
                </Button>
              </Link>
            </div>
          }
        />

        <div className="mt-6">
          <CheckList
            organizationId={organization?.id || ""}
            className="rounded-md border"
            initialFilters={{
              status: selectedStatuses,
              dateRange: dateRange || undefined
            }}
            virtualScrolling
          />
        </div>
      </DashboardShell>
    </ErrorBoundary>
  );
};

export default BackgroundChecksPage;