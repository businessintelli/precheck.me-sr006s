// OpenAI API Client - v4.0.0
import { OpenAI } from 'openai';
// TensorFlow.js Node - v4.10.0
import * as tf from '@tensorflow/tfjs-node';

// Global constants
const OPENAI_API_VERSION = '2023-05-15';
const ML_MODEL_PATH = './models/document-verification-v1';
const DEFAULT_CONFIDENCE_THRESHOLD = 0.9999;
const MAX_RETRY_ATTEMPTS = 3;

// Document AI Configuration
export const DOCUMENT_AI_CONFIG = {
  MIN_CONFIDENCE_SCORE: DEFAULT_CONFIDENCE_THRESHOLD,
  OCR_ENABLED: true,
  MODEL_PATH: ML_MODEL_PATH,
  SUPPORTED_FORMATS: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff'
  ],
  BATCH_SIZE: 32, // Optimal batch size for TensorFlow processing
  VERIFICATION_TIMEOUT: 30000, // 30 seconds timeout for verification
  PERFORMANCE_SETTINGS: {
    useGPU: true,
    tensorflowOptimizations: {
      enablePredictionsQueue: true,
      enableTensorflowOps: true,
      enableTensorflowKernels: true
    }
  }
};

// Interview AI Configuration
export const INTERVIEW_AI_CONFIG = {
  ANALYSIS_THRESHOLD: 0.95, // Confidence threshold for response analysis
  MAX_QUESTIONS: 15, // Maximum questions per interview session
  RESPONSE_TIME_LIMIT: 300, // 5 minutes per response
  MIN_RESPONSE_LENGTH: 50, // Minimum characters for valid response
  STREAMING_ENABLED: true,
  REAL_TIME_ANALYSIS: true,
  PERFORMANCE_METRICS: {
    enableLatencyTracking: true,
    enableAccuracyMetrics: true,
    samplingRate: 1.0
  }
};

// OpenAI Configuration
export const OPENAI_CONFIG = {
  API_VERSION: OPENAI_API_VERSION,
  MODEL: 'gpt-4',
  MAX_TOKENS: 2048,
  TEMPERATURE: 0.7,
  RETRY_CONFIG: {
    maxAttempts: MAX_RETRY_ATTEMPTS,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryableErrors: [
      'rate_limit_exceeded',
      'timeout',
      'service_unavailable'
    ]
  }
};

// Environment-specific configuration functions
export const getDocumentAIConfig = (environment: string): typeof DOCUMENT_AI_CONFIG => {
  const baseConfig = { ...DOCUMENT_AI_CONFIG };
  
  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        MIN_CONFIDENCE_SCORE: DEFAULT_CONFIDENCE_THRESHOLD,
        BATCH_SIZE: 64,
        PERFORMANCE_SETTINGS: {
          ...baseConfig.PERFORMANCE_SETTINGS,
          useGPU: true,
          tensorflowOptimizations: {
            enablePredictionsQueue: true,
            enableTensorflowOps: true,
            enableTensorflowKernels: true
          }
        }
      };
    case 'staging':
      return {
        ...baseConfig,
        MIN_CONFIDENCE_SCORE: 0.98,
        BATCH_SIZE: 32,
        PERFORMANCE_SETTINGS: {
          ...baseConfig.PERFORMANCE_SETTINGS,
          useGPU: true
        }
      };
    default: // development
      return {
        ...baseConfig,
        MIN_CONFIDENCE_SCORE: 0.95,
        BATCH_SIZE: 16,
        PERFORMANCE_SETTINGS: {
          ...baseConfig.PERFORMANCE_SETTINGS,
          useGPU: false
        }
      };
  }
};

export const getInterviewAIConfig = (environment: string): typeof INTERVIEW_AI_CONFIG => {
  const baseConfig = { ...INTERVIEW_AI_CONFIG };
  
  switch (environment) {
    case 'production':
      return {
        ...baseConfig,
        ANALYSIS_THRESHOLD: 0.95,
        STREAMING_ENABLED: true,
        REAL_TIME_ANALYSIS: true,
        PERFORMANCE_METRICS: {
          ...baseConfig.PERFORMANCE_METRICS,
          samplingRate: 1.0,
          enableLatencyTracking: true
        }
      };
    case 'staging':
      return {
        ...baseConfig,
        ANALYSIS_THRESHOLD: 0.90,
        STREAMING_ENABLED: true,
        REAL_TIME_ANALYSIS: true,
        PERFORMANCE_METRICS: {
          ...baseConfig.PERFORMANCE_METRICS,
          samplingRate: 0.5
        }
      };
    default: // development
      return {
        ...baseConfig,
        ANALYSIS_THRESHOLD: 0.85,
        STREAMING_ENABLED: false,
        REAL_TIME_ANALYSIS: false,
        PERFORMANCE_METRICS: {
          ...baseConfig.PERFORMANCE_METRICS,
          samplingRate: 0.1
        }
      };
  }
};