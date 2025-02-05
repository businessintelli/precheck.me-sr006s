"use client";

import * as React from "react"; // @version ^18.0.0
import { useRouter } from "next/navigation"; // @version 14.0.0
import { Button } from "../components/shared/Button";

/**
 * Enhanced 404 Not Found page component with Material Design styling,
 * accessibility features, and error tracking capabilities.
 */
const NotFound: React.FC = () => {
  const router = useRouter();

  // Track page view for analytics
  React.useEffect(() => {
    // Log 404 error occurrence for monitoring
    console.error("404 Error: Page not found", {
      path: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  /**
   * Handles navigation to previous page with error tracking
   */
  const handleGoBack = React.useCallback(() => {
    try {
      // Log navigation attempt
      console.debug("404 page: Attempting to navigate back");
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  /**
   * Handles navigation to home page with error tracking
   */
  const handleGoHome = React.useCallback(() => {
    try {
      // Log navigation attempt
      console.debug("404 page: Navigating to home");
      router.push("/");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }, [router]);

  return (
    // Main container with responsive padding and centering
    <main 
      className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-6"
      // Enhanced accessibility attributes
      role="main"
      aria-labelledby="error-title"
    >
      <div className="mx-auto flex max-w-[450px] flex-col items-center justify-center text-center">
        {/* Error status with semantic heading */}
        <h1 
          id="error-title"
          className="text-3xl md:text-4xl font-bold tracking-tight text-primary"
          aria-label="404 - Page Not Found"
        >
          404
        </h1>

        {/* Error description with proper contrast */}
        <p 
          className="mt-4 text-base md:text-lg text-muted-foreground"
          aria-label="This page could not be found"
        >
          This page could not be found.
        </p>

        {/* Navigation actions with keyboard accessibility */}
        <div 
          className="mt-6 md:mt-8 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4"
          role="group"
          aria-label="Navigation options"
        >
          {/* Back button with ghost variant */}
          <Button
            onClick={handleGoBack}
            variant="ghost"
            aria-label="Go back to previous page"
          >
            Go Back
          </Button>

          {/* Home button with primary variant */}
          <Button
            onClick={handleGoHome}
            variant="primary"
            aria-label="Return to home page"
          >
            Go Home
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;