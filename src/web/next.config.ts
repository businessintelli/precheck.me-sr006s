import type { NextConfig } from 'next'; // v14.0.0
import withTM from 'next-transpile-modules'; // v10.0.0

// Security headers configuration for enhanced protection
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; " +
           "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
           "style-src 'self' 'unsafe-inline'; " +
           "img-src 'self' data: https: blob:; " +
           "font-src 'self' data:; " +
           "connect-src 'self' wss: https:; " +
           "media-src 'self' blob:; " +
           "worker-src 'self' blob:; " +
           "frame-src 'self'; " +
           "base-uri 'self'; " +
           "form-action 'self';"
  }
];

// Base configuration object
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Environment variables configuration
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_STORAGE_URL: process.env.NEXT_PUBLIC_STORAGE_URL
  },

  // Image optimization configuration
  images: {
    domains: ['storage.precheck.me'],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },

  // Security headers configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // API route rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      },
    ];
  },

  // Webpack configuration for SVG and module support
  webpack(config, { dev, isServer }) {
    // Add SVG support
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // Build optimization settings
  swcMinify: true,
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
    // Enable styled-components support
    styledComponents: true,
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: true,
    // Enable instrumentation hook for monitoring
    instrumentationHook: true,
    // Enable CSS optimization
    optimizeCss: true,
    // Enable scroll restoration
    scrollRestoration: true,
    // Disable legacy browser support
    legacyBrowsers: false,
  },
};

// Export the configuration with module transpilation support
export default withTM([])(config);