'use client';

import { Inter } from '@next/font/google'; // ^14.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import React from 'react';

import ThemeProvider from '../providers/ThemeProvider';
import NotificationProvider from '../providers/NotificationProvider';
import WebSocketProvider from '../providers/WebSocketProvider';
import AuthProvider from '../providers/AuthProvider';

import '../styles/globals.css';

// Configure Inter font with optimization
const inter = Inter({ 
  subsets: ['latin'], 
  display: 'swap', 
  preload: true,
  variable: '--font-inter'
});

/**
 * Props interface for RootLayout component
 */
interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Error fallback component for ErrorBoundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => {
  return (
    <div role="alert" className="error-boundary">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
    </div>
  );
};

/**
 * Metadata configuration for the application
 */
export const generateMetadata = () => {
  return {
    title: 'Precheck.me - Background Check & AI Interview Platform',
    description: 'Comprehensive background verification and AI-powered interview platform for modern hiring processes',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#ffffff' },
      { media: '(prefers-color-scheme: dark)', color: '#18181b' }
    ],
    manifest: '/manifest.json',
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png'
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: 'https://precheck.me',
      title: 'Precheck.me - Background Check & AI Interview Platform',
      description: 'Comprehensive background verification and AI-powered interview platform',
      siteName: 'Precheck.me'
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Precheck.me - Background Check & AI Interview Platform',
      description: 'Comprehensive background verification and AI-powered interview platform'
    }
  };
};

/**
 * Root layout component that provides global providers and configuration
 * Implements Material Design 3.0 principles and handles core functionality
 */
const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta charSet="utf-8" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#18181b" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ThemeProvider 
            defaultTheme="system"
            enableHighContrast={true}
            enableAnimations={true}
          >
            <AuthProvider>
              <WebSocketProvider
                enableDebug={process.env.NODE_ENV === 'development'}
                onConnectionError={(error) => {
                  console.error('WebSocket connection error:', error);
                }}
              >
                <NotificationProvider
                  maxNotifications={100}
                  retryAttempts={3}
                  debounceMs={300}
                >
                  <main 
                    id="main-content"
                    className="app-root"
                    data-theme-mode="system"
                    data-color-scheme="auto"
                  >
                    {/* Skip to main content link for accessibility */}
                    <a 
                      href="#main-content" 
                      className="skip-link"
                      aria-label="Skip to main content"
                    >
                      Skip to main content
                    </a>

                    {/* Live region for accessibility announcements */}
                    <div 
                      aria-live="polite" 
                      aria-atomic="true" 
                      className="sr-only"
                    />

                    {/* Main application content */}
                    {children}
                  </main>
                </NotificationProvider>
              </WebSocketProvider>
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>

        {/* Reduced motion style override */}
        <style jsx global>{`
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }
        `}</style>
      </body>
    </html>
  );
};

export default RootLayout;