import { BackgroundCheckType } from '../types/background-check.types';
import { DocumentType } from '../types/document.types';

/**
 * Base API URL from environment variables with fallback
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

/**
 * WebSocket URL for real-time updates with environment-specific configuration
 */
export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL ?? 
  (process.env.NODE_ENV === 'production' ? 'wss://api.precheck.me/ws' : 'ws://localhost:3000/ws');

/**
 * Maximum file size for document uploads (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Supported file types for document uploads
 */
export const SUPPORTED_FILE_TYPES = Object.freeze(['.pdf', '.jpg', '.jpeg', '.png']);

/**
 * Default currency for pricing display
 */
export const DEFAULT_CURRENCY = 'USD';

/**
 * Default locale for formatting
 */
export const DEFAULT_LOCALE = 'en-US';

/**
 * API endpoints configuration for all services
 */
export const API_ENDPOINTS = Object.freeze({
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    MFA_VERIFY: '/auth/mfa/verify',
    MFA_SETUP: '/auth/mfa/setup'
  },
  BACKGROUND_CHECKS: {
    BASE: '/background-checks',
    CREATE: '/background-checks/create',
    UPDATE: '/background-checks/:id',
    DELETE: '/background-checks/:id',
    STATUS: '/background-checks/:id/status',
    VERIFY: '/background-checks/:id/verify'
  },
  DOCUMENTS: {
    BASE: '/documents',
    UPLOAD: '/documents/upload',
    VERIFY: '/documents/:id/verify',
    DOWNLOAD: '/documents/:id/download',
    SCAN: '/documents/:id/scan'
  },
  INTERVIEWS: {
    BASE: '/interviews',
    SCHEDULE: '/interviews/schedule',
    JOIN: '/interviews/:id/join',
    RECORD: '/interviews/:id/record',
    ANALYZE: '/interviews/:id/analyze'
  }
});

/**
 * Interface for package pricing and features
 */
interface PackageDetails {
  price: number;
  features: string[];
  requiredDocuments: DocumentType[];
  processingTime: string;
  description: string;
}

/**
 * Background check package pricing and feature configuration
 */
export const PACKAGE_PRICING: Readonly<Record<BackgroundCheckType, PackageDetails>> = Object.freeze({
  [BackgroundCheckType.BASIC]: {
    price: 99.99,
    features: [
      'Identity Verification',
      'Employment History Check',
      'Basic Background Report'
    ],
    requiredDocuments: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.PROOF_OF_ADDRESS,
      DocumentType.EMPLOYMENT_RECORD
    ],
    processingTime: '2-3 business days',
    description: 'Essential verification package for basic employment screening'
  },
  [BackgroundCheckType.STANDARD]: {
    price: 199.99,
    features: [
      'All Basic Package Features',
      'Education Verification',
      'Professional References',
      'Detailed Background Report'
    ],
    requiredDocuments: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.PROOF_OF_ADDRESS,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE
    ],
    processingTime: '3-5 business days',
    description: 'Comprehensive verification package for professional positions'
  },
  [BackgroundCheckType.COMPREHENSIVE]: {
    price: 299.99,
    features: [
      'All Standard Package Features',
      'Criminal Record Check',
      'Global Watch List Screening',
      'Professional License Verification',
      'Complete Background Analysis'
    ],
    requiredDocuments: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.PROOF_OF_ADDRESS,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE
    ],
    processingTime: '5-7 business days',
    description: 'Complete verification solution for senior and sensitive positions'
  }
});

/**
 * Interface for UI configuration constants
 */
interface UIConfiguration {
  BREAKPOINTS: Record<string, number>;
  ANIMATION_DURATION: Record<string, number>;
  TOAST_DURATION: Record<string, number | null>;
  DIRECTION: Record<string, string>;
  THEME: Record<string, string>;
}

/**
 * UI-related constants following Material Design 3.0 principles
 */
export const UI_CONSTANTS: Readonly<UIConfiguration> = Object.freeze({
  BREAKPOINTS: {
    mobile: 640,
    tablet: 768,
    desktop: 1024,
    wide: 1280,
    ultrawide: 1536
  },
  ANIMATION_DURATION: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
    verySlow: 800
  },
  TOAST_DURATION: {
    short: 3000,
    normal: 5000,
    long: 8000,
    persistent: null
  },
  DIRECTION: {
    ltr: 'ltr',
    rtl: 'rtl'
  },
  THEME: {
    light: 'light',
    dark: 'dark',
    system: 'system'
  }
});