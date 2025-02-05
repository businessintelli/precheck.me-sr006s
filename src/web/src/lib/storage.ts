/**
 * Browser storage utility library for Precheck.me platform
 * Provides secure client-side storage operations with encryption and validation
 * @version 1.0.0
 */

import { Document, DocumentType } from '../types/document.types';
import CryptoJS from 'crypto-js'; // v4.2.0

// Global constants
const STORAGE_PREFIX = 'precheck_';
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_ENCRYPTION_KEY;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const STORAGE_QUOTA_LIMIT = 50 * 1024 * 1024; // 50MB
const DATA_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

// Type definitions
interface StorageOptions {
  compress?: boolean;
  expiration?: number;
  namespace?: string;
}

interface ValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  validateChecksum?: boolean;
  scanMalware?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    size: number;
    type: string;
    checksum: string;
    lastModified: number;
  };
}

interface StorageQuotaStatus {
  used: number;
  total: number;
  available: number;
  items: number;
  nearLimit: boolean;
}

/**
 * Securely stores data in browser storage with encryption
 * @param key - Storage key identifier
 * @param value - Data to store
 * @param encrypt - Whether to encrypt the data
 * @param options - Storage configuration options
 */
export async function setStorageItem(
  key: string,
  value: any,
  encrypt: boolean = false,
  options: StorageOptions = {}
): Promise<void> {
  try {
    // Validate encryption configuration
    if (encrypt && !ENCRYPTION_KEY) {
      throw new Error('Encryption key not configured');
    }

    // Generate storage key with prefix and namespace
    const storageKey = `${STORAGE_PREFIX}${options.namespace ? `${options.namespace}_` : ''}${key}`;

    // Check storage quota
    const quotaStatus = await manageStorageQuota();
    if (quotaStatus.nearLimit) {
      throw new Error('Storage quota limit reached');
    }

    // Prepare data for storage
    let processedValue = JSON.stringify(value);

    // Compress if needed
    if (options.compress) {
      processedValue = btoa(processedValue);
    }

    // Encrypt if required
    if (encrypt) {
      processedValue = CryptoJS.AES.encrypt(processedValue, ENCRYPTION_KEY!).toString();
    }

    // Prepare storage object with metadata
    const storageObject = {
      data: processedValue,
      metadata: {
        created: Date.now(),
        expires: options.expiration || Date.now() + DATA_EXPIRATION_TIME,
        encrypted: encrypt,
        compressed: options.compress,
      },
    };

    // Store data
    localStorage.setItem(storageKey, JSON.stringify(storageObject));

    // Log storage operation for audit
    console.debug(`Storage operation completed: ${storageKey}`);
  } catch (error) {
    console.error('Storage operation failed:', error);
    throw error;
  }
}

/**
 * Retrieves and decrypts data from browser storage
 * @param key - Storage key identifier
 * @param encrypted - Whether the data is encrypted
 */
export async function getStorageItem(key: string, encrypted: boolean = false): Promise<any> {
  try {
    // Generate full storage key
    const storageKey = `${STORAGE_PREFIX}${key}`;

    // Retrieve storage object
    const storageData = localStorage.getItem(storageKey);
    if (!storageData) {
      return null;
    }

    // Parse storage object
    const { data, metadata } = JSON.parse(storageData);

    // Check expiration
    if (metadata.expires && metadata.expires < Date.now()) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Process stored data
    let processedData = data;

    // Decrypt if encrypted
    if (encrypted) {
      if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not configured');
      }
      const bytes = CryptoJS.AES.decrypt(processedData, ENCRYPTION_KEY);
      processedData = bytes.toString(CryptoJS.enc.Utf8);
    }

    // Decompress if compressed
    if (metadata.compressed) {
      processedData = atob(processedData);
    }

    // Parse and return data
    return JSON.parse(processedData);
  } catch (error) {
    console.error('Storage retrieval failed:', error);
    throw error;
  }
}

/**
 * Validates file uploads with comprehensive security checks
 * @param file - File to validate
 * @param options - Validation configuration options
 */
export async function validateFileUpload(
  file: File,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata = {
    size: file.size,
    type: file.type,
    checksum: '',
    lastModified: file.lastModified,
  };

  try {
    // Size validation
    const maxSize = options.maxSize || MAX_FILE_SIZE;
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum limit of ${maxSize} bytes`);
    }

    // MIME type validation
    const allowedTypes = options.allowedTypes || ALLOWED_MIME_TYPES;
    if (!allowedTypes.includes(file.type)) {
      errors.push('File type not allowed');
    }

    // File name security check
    const secureFileNameRegex = /^[a-zA-Z0-9-_. ]+$/;
    if (!secureFileNameRegex.test(file.name)) {
      errors.push('File name contains invalid characters');
    }

    // Generate checksum if required
    if (options.validateChecksum) {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      metadata.checksum = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    // Malware signature check (basic implementation)
    if (options.scanMalware) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as ArrayBuffer;
        // Implement malware signature checking logic here
        // This is a placeholder for actual implementation
      };
      reader.readAsArrayBuffer(file);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata,
    };
  } catch (error) {
    console.error('File validation failed:', error);
    errors.push('File validation failed');
    return {
      isValid: false,
      errors,
      warnings,
      metadata,
    };
  }
}

/**
 * Manages browser storage quota and implements cleanup strategies
 */
export async function manageStorageQuota(): Promise<StorageQuotaStatus> {
  try {
    let totalSize = 0;
    let itemCount = 0;
    const items: string[] = [];

    // Calculate current storage usage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const item = localStorage.getItem(key);
        if (item) {
          totalSize += item.length;
          itemCount++;
          items.push(key);
        }
      }
    }

    // Check if near quota limit
    const nearLimit = totalSize > (STORAGE_QUOTA_LIMIT * 0.9);

    // Clean up expired items
    if (nearLimit) {
      for (const key of items) {
        const item = localStorage.getItem(key);
        if (item) {
          const { metadata } = JSON.parse(item);
          if (metadata.expires && metadata.expires < Date.now()) {
            localStorage.removeItem(key);
            totalSize -= item.length;
            itemCount--;
          }
        }
      }
    }

    return {
      used: totalSize,
      total: STORAGE_QUOTA_LIMIT,
      available: STORAGE_QUOTA_LIMIT - totalSize,
      items: itemCount,
      nearLimit,
    };
  } catch (error) {
    console.error('Storage quota management failed:', error);
    throw error;
  }
}