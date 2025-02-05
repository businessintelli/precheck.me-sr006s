/**
 * Browser storage utility functions for secure client-side storage operations
 * Implements enhanced encryption, quota management, and comprehensive file validation
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.2.0
import { DocumentType } from '../types/document.types';

// Constants for storage configuration
const STORAGE_PREFIX = 'precheck_';
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_ENCRYPTION_KEY;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const STORAGE_QUOTA_LIMIT = 50 * 1024 * 1024; // 50MB
const IV_LENGTH = 16;

/**
 * Securely stores data in browser storage with enhanced encryption
 * @param key - Storage key
 * @param value - Data to store
 * @param encrypt - Whether to encrypt the data
 * @throws Error if storage operation fails
 */
export const setStorageItem = async (
  key: string,
  value: any,
  encrypt: boolean = false
): Promise<void> => {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid storage key');
  }

  try {
    // Check storage quota
    const hasSpace = await checkStorageQuota(JSON.stringify(value).length);
    if (!hasSpace) {
      throw new Error('Storage quota exceeded');
    }

    let processedValue = value;

    if (encrypt && ENCRYPTION_KEY) {
      // Generate random IV
      const iv = CryptoJS.lib.WordArray.random(IV_LENGTH);
      
      // Derive key using PBKDF2
      const derivedKey = CryptoJS.PBKDF2(ENCRYPTION_KEY, iv, {
        keySize: 256 / 32,
        iterations: 1000
      });

      // Stringify if object or array
      if (typeof value === 'object') {
        processedValue = JSON.stringify(value);
      }

      // Encrypt with AES-256-GCM
      const encrypted = CryptoJS.AES.encrypt(processedValue, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7
      });

      // Combine IV and encrypted data
      processedValue = iv.toString() + encrypted.toString();
    }

    localStorage.setItem(STORAGE_PREFIX + key, processedValue);

    // Emit storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_PREFIX + key,
      newValue: processedValue
    }));
  } catch (error) {
    throw new Error(`Storage operation failed: ${error.message}`);
  }
};

/**
 * Retrieves and decrypts data from browser storage
 * @param key - Storage key
 * @param encrypted - Whether the data is encrypted
 * @returns Retrieved and processed storage value or null
 */
export const getStorageItem = async (
  key: string,
  encrypted: boolean = false
): Promise<any> => {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid storage key');
  }

  try {
    const data = localStorage.getItem(STORAGE_PREFIX + key);
    
    if (!data) {
      return null;
    }

    if (encrypted && ENCRYPTION_KEY) {
      // Extract IV and encrypted data
      const iv = CryptoJS.enc.Hex.parse(data.slice(0, IV_LENGTH * 2));
      const encrypted = data.slice(IV_LENGTH * 2);

      // Derive key using PBKDF2
      const derivedKey = CryptoJS.PBKDF2(ENCRYPTION_KEY, iv, {
        keySize: 256 / 32,
        iterations: 1000
      });

      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(encrypted, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7
      });

      try {
        // Attempt to parse as JSON
        return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      } catch {
        // Return as string if not JSON
        return decrypted.toString(CryptoJS.enc.Utf8);
      }
    }

    try {
      // Attempt to parse non-encrypted data as JSON
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (error) {
    throw new Error(`Storage retrieval failed: ${error.message}`);
  }
};

/**
 * Validates file for upload with enhanced security checks
 * @param file - File to validate
 * @param documentType - Type of document being uploaded
 * @returns Validation result with error message and file hash
 */
export const validateFileUpload = async (
  file: File,
  documentType: DocumentType
): Promise<{ isValid: boolean; error?: string; hash?: string }> => {
  try {
    // Check if file exists
    if (!file) {
      return { isValid: false, error: 'No file provided' };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { isValid: false, error: 'File size exceeds maximum limit' };
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { isValid: false, error: 'Invalid file type' };
    }

    // Validate file extension matches MIME type
    const extension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = {
      'application/pdf': ['pdf'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png']
    };
    if (!validExtensions[file.type]?.includes(extension)) {
      return { isValid: false, error: 'File extension does not match type' };
    }

    // Calculate file hash
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Validate document type
    if (!Object.values(DocumentType).includes(documentType)) {
      return { isValid: false, error: 'Invalid document type' };
    }

    return { isValid: true, hash };
  } catch (error) {
    return { isValid: false, error: `Validation failed: ${error.message}` };
  }
};

/**
 * Checks available storage quota and manages storage cleanup
 * @param requiredSpace - Required space in bytes
 * @returns True if space available, false if quota exceeded
 */
export const checkStorageQuota = async (
  requiredSpace: number
): Promise<boolean> => {
  try {
    // Estimate current storage usage
    let currentUsage = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const item = localStorage.getItem(key);
        currentUsage += item ? item.length : 0;
      }
    }

    // Check if adding required space would exceed quota
    if (currentUsage + requiredSpace > STORAGE_QUOTA_LIMIT) {
      // Attempt cleanup of expired items
      const cleanupThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          try {
            const item = await getStorageItem(key.replace(STORAGE_PREFIX, ''));
            if (item?.timestamp && item.timestamp < cleanupThreshold) {
              localStorage.removeItem(key);
              currentUsage = await checkStorageQuota(0);
            }
          } catch {
            // Skip invalid items
            continue;
          }
        }
      }

      // Check if cleanup freed enough space
      return (currentUsage + requiredSpace) <= STORAGE_QUOTA_LIMIT;
    }

    return true;
  } catch (error) {
    throw new Error(`Storage quota check failed: ${error.message}`);
  }
};