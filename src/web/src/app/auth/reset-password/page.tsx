"use client";

import React, { Suspense } from 'react';
import { motion } from 'framer-motion'; // v10.0.0
import { Metadata, headers } from 'next'; // v14.0.0
import { rateLimit } from '@precheck/rate-limit'; // v1.0.0
import ResetPasswordForm from '../../../components/auth/ResetPasswordForm';

// Constants for rate limiting and security
const RATE_LIMIT_WINDOW = 300; // 5 minutes in seconds
const MAX_ATTEMPTS = 3;
const TOKEN_EXPIRY = 3600; // 1 hour in seconds

// Loading fallback component
const LoadingState = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  </div>
);

// Error animation variants
const errorAnimation = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 }
};

/**
 * Generate enhanced metadata for the reset password page
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Reset Password | Precheck.me',
    description: 'Reset your password securely on Precheck.me platform',
    robots: {
      index: false,
      follow: false,
    },
    headers: {
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }
  };
}

/**
 * Validate reset token with rate limiting and security checks
 */
async function validateResetToken(token: string): Promise<boolean> {
  try {
    // Check rate limiting
    const rateLimitResult = await rateLimit({
      key: `reset-password-${token}`,
      window: RATE_LIMIT_WINDOW,
      maxAttempts: MAX_ATTEMPTS
    });

    if (!rateLimitResult.success) {
      throw new Error('Too many attempts. Please try again later.');
    }

    // Validate token format
    if (!token || !/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(token)) {
      return false;
    }

    // Check token expiration
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = tokenData.exp * 1000;
    
    if (Date.now() > expirationTime) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Reset Password Page Component
 */
export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token;
  
  // Handle missing token
  if (!token) {
    return (
      <div className="container flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={errorAnimation}
        >
          <div className="text-center text-red-500">
            <h1 className="text-2xl font-bold mb-4">Invalid Request</h1>
            <p>No reset token provided. Please request a new password reset.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Validate token
  const isValidToken = await validateResetToken(token);

  if (!isValidToken) {
    return (
      <div className="container flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <motion.div
          className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={errorAnimation}
        >
          <div className="text-center text-red-500">
            <h1 className="text-2xl font-bold mb-4">Invalid or Expired Token</h1>
            <p>Please request a new password reset link.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-8">
            Reset Your Password
          </h1>
        </div>
        
        <Suspense fallback={<LoadingState />}>
          <ResetPasswordForm token={token} />
        </Suspense>
      </div>
    </div>
  );
}