"use client";

import React, { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { ErrorBoundary } from "react-error-boundary";
import { analytics } from "@segment/analytics-next";

import DashboardShell from "@/components/layout/DashboardShell";
import PageHeader from "@/components/layout/PageHeader";
import CheckForm from "@/components/background-checks/CheckForm";
import { useAuth } from "@/hooks/useAuth";

/**
 * Error fallback component for graceful error handling
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-6 text-center">
    <h3 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h3>
    <p className="text-gray-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
    >
      Try again
    </button>
  </div>
);

/**
 * New Background Check page component
 * Implements form for initiating background checks with comprehensive validation
 */
const NewBackgroundCheckPage = () => {
  const router = useRouter();
  const { user, organization } = useAuth();

  // Ensure user is authenticated and has organization context
  if (!user || !organization) {
    router.push("/auth/login");
    return null;
  }

  /**
   * Handle successful background check creation
   */
  const handleCheckCreated = useCallback(async (checkId: string) => {
    try {
      // Track successful creation in analytics
      analytics.track("background_check_created", {
        checkId,
        organizationId: organization.id,
        userId: user.id,
        timestamp: new Date().toISOString()
      });

      // Show success message
      toast.success("Background check initiated successfully");

      // Navigate to check details
      router.push(`/dashboard/background-checks/${checkId}`);
    } catch (error) {
      console.error("Failed to handle check creation:", error);
      toast.error("An error occurred while processing your request");
    }
  }, [organization.id, user.id, router]);

  return (
    <DashboardShell>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => router.refresh()}
        onError={(error) => {
          console.error("Background check error:", error);
          analytics.track("background_check_error", {
            error: error.message,
            organizationId: organization.id,
            userId: user.id
          });
        }}
      >
        <div className="min-h-screen">
          <PageHeader
            heading="New Background Check"
            description="Initiate a new background check by providing candidate information and required documents."
            breadcrumbs={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Background Checks", href: "/dashboard/background-checks" },
              { label: "New Check", href: "/dashboard/background-checks/new", current: true }
            ]}
          />

          <main className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <CheckForm
                organizationId={organization.id}
                onSuccess={handleCheckCreated}
                csrfToken={process.env.NEXT_PUBLIC_CSRF_TOKEN || ""}
              />
            </div>
          </main>
        </div>
      </ErrorBoundary>
    </DashboardShell>
  );
};

export default NewBackgroundCheckPage;