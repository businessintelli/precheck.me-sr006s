/**
 * Storage Configuration for S3-compatible Document Storage Service
 * @version 1.0.0
 * @module config/storage
 * 
 * Implements comprehensive configuration for document storage including:
 * - Security settings and encryption
 * - Versioning and lifecycle policies
 * - Regional distribution
 * - Performance optimization
 * - Monitoring and logging
 */

import { S3ClientConfig } from '@aws-sdk/client-s3'; // ^3.0.0

// Allowed document MIME types for upload
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

// Maximum file size (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Available storage regions
export const STORAGE_REGIONS = {
  US: 'us-east-1',
  IN: 'ap-south-1'
} as const;

// Environment-specific bucket prefixes
export const BUCKET_PREFIXES = {
  development: 'dev',
  staging: 'stg',
  production: 'prod'
} as const;

// Storage configuration interface
interface StorageConfig extends S3ClientConfig {
  provider: string;
  bucketName: string;
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyId?: string;
    clientSideEnabled: boolean;
  };
  versioning: {
    enabled: boolean;
    retentionPeriod: number;
    mfaDelete: boolean;
  };
  lifecycle: {
    enabled: boolean;
    rules: Array<{
      prefix: string;
      enabled: boolean;
      expiration?: number;
      transition?: {
        days: number;
        storageClass: string;
      };
    }>;
  };
  security: {
    publicAccessBlock: boolean;
    corsEnabled: boolean;
    corsRules: Array<{
      allowedOrigins: string[];
      allowedMethods: string[];
      maxAgeSeconds: number;
    }>;
    sslOnly: boolean;
  };
  performance: {
    accelerationEnabled: boolean;
    cachingEnabled: boolean;
    maxConnections: number;
  };
  monitoring: {
    metrics: boolean;
    logging: boolean;
    logRetention: number;
  };
}

/**
 * Generates environment-specific storage configuration
 * @param environment - Deployment environment (development/staging/production)
 * @param region - AWS region for storage
 * @returns Complete S3 client configuration
 */
export const getStorageConfig = (
  environment: keyof typeof BUCKET_PREFIXES,
  region: keyof typeof STORAGE_REGIONS
): StorageConfig => {
  const bucketPrefix = BUCKET_PREFIXES[environment];
  const regionName = STORAGE_REGIONS[region];

  const config: StorageConfig = {
    provider: 'aws',
    region: regionName,
    bucketName: `${bucketPrefix}-precheck-documents-${regionName}`,
    endpoint: undefined, // Use default AWS endpoint
    credentials: undefined, // Use AWS credentials provider chain
    
    // Encryption configuration
    encryption: {
      enabled: true,
      algorithm: 'AES256',
      clientSideEnabled: environment === 'production',
      ...(environment === 'production' && {
        keyId: process.env.AWS_KMS_KEY_ID
      })
    },

    // Versioning configuration
    versioning: {
      enabled: environment !== 'development',
      retentionPeriod: environment === 'production' ? 2555 : 365, // 7 years for prod, 1 year others
      mfaDelete: environment === 'production'
    },

    // Lifecycle policies
    lifecycle: {
      enabled: true,
      rules: [
        {
          prefix: 'temp/',
          enabled: true,
          expiration: 1 // 1 day for temporary files
        },
        {
          prefix: 'archive/',
          enabled: true,
          transition: {
            days: 90,
            storageClass: 'GLACIER'
          }
        }
      ]
    },

    // Security settings
    security: {
      publicAccessBlock: true,
      corsEnabled: true,
      corsRules: [
        {
          allowedOrigins: [process.env.FRONTEND_URL || '*'],
          allowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          maxAgeSeconds: 3600
        }
      ],
      sslOnly: true
    },

    // Performance optimization
    performance: {
      accelerationEnabled: environment === 'production',
      cachingEnabled: true,
      maxConnections: environment === 'production' ? 50 : 25
    },

    // Monitoring configuration
    monitoring: {
      metrics: true,
      logging: environment !== 'development',
      logRetention: environment === 'production' ? 2555 : 90 // 7 years for prod, 90 days others
    }
  };

  return config;
};

/**
 * Validates storage configuration completeness and correctness
 * @param config - Storage configuration to validate
 * @returns Validation result
 */
export const validateStorageConfig = (config: StorageConfig): boolean => {
  try {
    // Required fields validation
    if (!config.region || !config.bucketName) {
      throw new Error('Missing required configuration: region or bucketName');
    }

    // Encryption validation
    if (config.encryption.enabled && !config.encryption.algorithm) {
      throw new Error('Encryption enabled but no algorithm specified');
    }

    // Security validation
    if (!config.security.corsRules || config.security.corsRules.length === 0) {
      throw new Error('CORS rules must be configured');
    }

    // Lifecycle validation
    if (config.lifecycle.enabled && (!config.lifecycle.rules || config.lifecycle.rules.length === 0)) {
      throw new Error('Lifecycle enabled but no rules configured');
    }

    // Performance validation
    if (config.performance.maxConnections < 1) {
      throw new Error('Invalid maxConnections value');
    }

    return true;
  } catch (error) {
    console.error('Storage configuration validation failed:', error);
    return false;
  }
};

// Export default configuration object
export const storageConfig = {
  provider: 'aws',
  region: STORAGE_REGIONS.US,
  bucketName: '',
  endpoint: undefined,
  encryption: {
    enabled: true,
    algorithm: 'AES256',
    clientSideEnabled: false
  },
  versioning: {
    enabled: true,
    retentionPeriod: 365,
    mfaDelete: false
  },
  lifecycle: {
    enabled: true,
    rules: []
  },
  security: {
    publicAccessBlock: true,
    corsEnabled: true,
    corsRules: [],
    sslOnly: true
  },
  performance: {
    accelerationEnabled: false,
    cachingEnabled: true,
    maxConnections: 25
  },
  monitoring: {
    metrics: true,
    logging: true,
    logRetention: 90
  }
};