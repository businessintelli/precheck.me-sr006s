"use client";

import React, { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import DashboardShell from "@/components/layout/DashboardShell";
import PageHeader from "@/components/layout/PageHeader";
import InterviewForm from "@/components/interviews/InterviewForm";
import { useInterview } from "@/hooks/useInterview";
import { useAuth } from "@/hooks/useAuth";
import { analytics } from "@/lib/analytics";
import { ErrorBoundary } from "react-error-boundary";

// Breadcrumb configuration for navigation
const breadcrumbs = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "🏠"
  },
  {
    label: "Interviews",
    href: "/dashboard/interviews",
    icon: "🎥"
  },
  {
    label: "Schedule",
    href: "/dashboard/interviews/schedule",
    current: true,
    icon: "📅"
  }
];

// Error fallback component for error boundary
const ErrorFallback = ({ error, resetErrorBoundary }: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) => (
  <div className="p-4 border border-red-200 rounded-md bg-red-50">
    <h3 className="text-lg font-medium text-red-800">Something went wrong</h3>
    <p className="mt-1 text-sm text-red-600">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-4 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
    >
      Try again
    </button>
  </div>
);

/**
 * Page component for scheduling AI-powered interviews
 * Implements role-based access control and real-time updates
 */
const SchedulePage = () => {
  const router = useRouter();
  const { user } = useAuth();

  // Initialize interview hook with real-time updates
  const {
    scheduleInterview,
    loading,
    error,
    connectionStatus
  } = useInterview(undefined, {
    autoConnect: true,
    enableRealtime: true,
    retryOnFailure: true
  });

  // Track page view for analytics
  useEffect(() => {
    analytics.trackPageView({
      page: "interview-schedule",
      userId: user?.id,
      organizationId: user?.organization_id
    });
  }, [user]);

  // Handle successful interview scheduling
  const handleInterviewScheduled = useCallback(async (interview: any) => {
    try {
      // Track successful scheduling
      analytics.track("interview_scheduled", {
        interviewId: interview.id,
        type: interview.type,
        userId: user?.id,
        organizationId: user?.organization_id
      });

      // Show success notification
      toast.success("Interview scheduled successfully", {
        duration: 5000,
        position: "top-right"
      });

      // Navigate to interview details
      router.push(`/dashboard/interviews/${interview.id}`);
    } catch (err) {
      console.error("Navigation error:", err);
      toast.error("Error navigating to interview details");
    }
  }, [router, user]);

  // Handle WebSocket connection status
  useEffect(() => {
    if (!connectionStatus.isConnected) {
      toast.warning("Attempting to establish real-time connection...", {
        id: "ws-connecting"
      });
    }
  }, [connectionStatus.isConnected]);

  return (
    <DashboardShell>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => window.location.reload()}
      >
        <div className="flex flex-col min-h-screen">
          <PageHeader
            heading="Schedule Interview"
            description="Schedule an AI-powered interview for candidate assessment"
            breadcrumbs={breadcrumbs}
          />

          <main className="flex-1 py-8">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl mx-auto">
                {error && (
                  <div className="mb-6 p-4 border border-red-200 rounded-md bg-red-50">
                    <p className="text-sm text-red-600">
                      {error.message || "An error occurred while scheduling the interview"}
                    </p>
                  </div>
                )}

                <InterviewForm
                  backgroundCheckId={user?.organization_id || ""}
                  candidateId={user?.id || ""}
                  onSuccess={handleInterviewScheduled}
                  className={loading.isScheduling ? "opacity-50 pointer-events-none" : ""}
                />

                {/* Connection status indicator */}
                {!connectionStatus.isConnected && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-700">
                      Establishing real-time connection...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    </DashboardShell>
  );
};

export default SchedulePage;