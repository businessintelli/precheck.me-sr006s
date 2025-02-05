import { BackgroundCheckType } from '../types/background-check.types';
import { DocumentType } from '../types/document.types';
import { InterviewType } from '../types/interview.types';

/**
 * API rate limiting configuration for different endpoints (requests per hour)
 */
export const API_RATE_LIMITS = {
  DEFAULT: 1000,
  AUTH: 100,
  DOCUMENT_UPLOAD: 500,
  INTERVIEW: 200,
  VERIFICATION: 300
} as const;

/**
 * Background check package configurations with pricing and features
 */
export const BACKGROUND_CHECK_PACKAGES = {
  [BackgroundCheckType.BASIC]: {
    price: 99.99,
    features: ['Identity Verification', 'Employment History'],
    duration_days: 3,
    required_documents: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD
    ]
  },
  [BackgroundCheckType.STANDARD]: {
    price: 199.99,
    features: ['Identity Verification', 'Employment History', 'Education Verification'],
    duration_days: 5,
    required_documents: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE
    ]
  },
  [BackgroundCheckType.COMPREHENSIVE]: {
    price: 299.99,
    features: ['Identity Verification', 'Employment History', 'Education Verification', 'Criminal Check', 'Professional References'],
    duration_days: 7,
    required_documents: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE,
      DocumentType.PROOF_OF_ADDRESS
    ]
  }
} as const;

/**
 * Document upload and verification configuration
 */
export const DOCUMENT_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic'
  ],
  REQUIRED_DOCUMENTS: {
    [BackgroundCheckType.BASIC]: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD
    ],
    [BackgroundCheckType.STANDARD]: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE
    ],
    [BackgroundCheckType.COMPREHENSIVE]: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.EMPLOYMENT_RECORD,
      DocumentType.EDUCATION_CERTIFICATE,
      DocumentType.PROOF_OF_ADDRESS
    ]
  },
  VERIFICATION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  RETRY_ATTEMPTS: 3
} as const;

/**
 * AI Interview configuration settings
 */
export const INTERVIEW_CONFIG = {
  DEFAULT_DURATION: 45 * 60, // 45 minutes in seconds
  MAX_QUESTIONS: {
    [InterviewType.TECHNICAL]: 15,
    [InterviewType.BEHAVIORAL]: 10,
    [InterviewType.MANAGEMENT]: 12
  },
  RESPONSE_TIME_LIMIT: 180, // 3 minutes per question in seconds
  AI_MODEL_CONFIG: {
    model: 'gpt-4',
    temperature: 0.7,
    max_tokens: 2048,
    presence_penalty: 0.6,
    frequency_penalty: 0.5
  },
  RECORDING_CONFIG: {
    format: 'audio/webm',
    sampleRate: 48000,
    channelCount: 1,
    bitRate: 128000
  }
} as const;

/**
 * Security configuration settings
 */
export const SECURITY_CONFIG = {
  PASSWORD_MIN_LENGTH: 12,
  JWT_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  MFA_CONFIG: {
    issuer: 'Precheck.me',
    digits: 6,
    step: 30,
    window: 1
  },
  SESSION_CONFIG: {
    cookie: {
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    },
    redis: {
      ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      prefix: 'session:'
    }
  }
} as const;

/**
 * Global application constants
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_FILE_SIZE_MB = 10;
export const TOKEN_EXPIRY_DAYS = 7;
export const VERIFICATION_TIMEOUT_MINUTES = 30;
export const MAX_RETRY_ATTEMPTS = 3;
export const CACHE_TTL_SECONDS = 3600;