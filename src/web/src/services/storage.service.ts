/**
 * Enhanced storage service for secure document handling in the Precheck.me platform
 * Implements client-side encryption, integrity validation, and secure storage operations
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.6.0
import CryptoJS from 'crypto-js'; // v4.1.1
import { Document, DocumentType, DocumentStatus, DocumentUploadResponse } from '../types/document.types';
import { setStorageItem, getStorageItem, validateFileUpload } from '../lib/storage';

interface SecurityConfig {
  encryptionAlgorithm: string;
  keySize: number;
  ivSize: number;
  iterations: number;
  chunkSize: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

/**
 * Service class for managing secure document storage operations
 * Implements comprehensive security measures and validation
 */
export class StorageService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxFileSize: number;
  private readonly storageQuota: number;
  private readonly axiosInstance: AxiosInstance;
  private readonly securityConfig: SecurityConfig;
  private readonly retryConfig: RetryConfig;

  constructor() {
    // Validate required environment variables
    if (!process.env.NEXT_PUBLIC_API_URL || !process.env.NEXT_PUBLIC_STORAGE_API_KEY) {
      throw new Error('Required environment variables not configured');
    }

    this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
    this.apiKey = process.env.NEXT_PUBLIC_STORAGE_API_KEY;
    this.maxFileSize = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE) || 10 * 1024 * 1024;
    this.storageQuota = Number(process.env.NEXT_PUBLIC_STORAGE_QUOTA) || 50 * 1024 * 1024;

    // Initialize axios instance with secure defaults
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Configure security settings
    this.securityConfig = {
      encryptionAlgorithm: 'AES-256-GCM',
      keySize: 256,
      ivSize: 128,
      iterations: 100000,
      chunkSize: 1024 * 1024, // 1MB chunks for upload
    };

    // Configure retry mechanism
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
    };
  }

  /**
   * Uploads a document with client-side encryption and integrity verification
   * @param file File to upload
   * @param documentType Type of document being uploaded
   * @param checkId Associated background check ID
   * @returns Promise resolving to uploaded document details
   */
  public async uploadDocument(
    file: File,
    documentType: DocumentType,
    checkId: string
  ): Promise<Document> {
    try {
      // Validate file
      const validationResult = await validateFileUpload(file, {
        maxSize: this.maxFileSize,
        validateChecksum: true,
        scanMalware: true,
      });

      if (!validationResult.isValid) {
        throw new Error(`File validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Generate encryption key and IV
      const iv = CryptoJS.lib.WordArray.random(this.securityConfig.ivSize / 8);
      const salt = CryptoJS.lib.WordArray.random(128 / 8);
      const key = CryptoJS.PBKDF2(this.apiKey, salt, {
        keySize: this.securityConfig.keySize / 32,
        iterations: this.securityConfig.iterations,
      });

      // Read and encrypt file
      const fileBuffer = await file.arrayBuffer();
      const encrypted = CryptoJS.AES.encrypt(
        CryptoJS.lib.WordArray.create(fileBuffer),
        key,
        { iv: iv }
      );

      // Request upload URL
      const uploadResponse = await this.retryOperation<DocumentUploadResponse>(
        async () => {
          const response = await this.axiosInstance.post('/documents/upload', {
            fileName: file.name,
            fileSize: file.size,
            documentType,
            checkId,
            checksum: validationResult.metadata.checksum,
          });
          return response.data;
        }
      );

      // Upload encrypted file in chunks
      const encryptedBlob = new Blob([encrypted.toString()]);
      const chunkSize = this.securityConfig.chunkSize;
      const chunks = Math.ceil(encryptedBlob.size / chunkSize);

      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, encryptedBlob.size);
        const chunk = encryptedBlob.slice(start, end);

        await this.retryOperation(
          async () => {
            await axios.put(
              `${uploadResponse.uploadUrl}&part=${i + 1}`,
              chunk,
              {
                headers: {
                  'Content-Type': 'application/octet-stream',
                },
              }
            );
          }
        );
      }

      // Store encryption metadata securely
      await setStorageItem(
        `doc_${uploadResponse.document.id}_key`,
        {
          key: key.toString(),
          iv: iv.toString(),
          salt: salt.toString(),
        },
        true,
        { expiration: 24 * 60 * 60 * 1000 } // 24 hours
      );

      return uploadResponse.document;
    } catch (error) {
      console.error('Document upload failed:', error);
      throw error;
    }
  }

  /**
   * Retrieves a secure, time-limited URL for document access
   * @param documentId ID of the document to access
   * @returns Promise resolving to secure document URL
   */
  public async getDocumentUrl(documentId: string): Promise<string> {
    try {
      // Retrieve encryption metadata
      const encryptionMeta = await getStorageItem(`doc_${documentId}_key`, true);
      if (!encryptionMeta) {
        throw new Error('Document encryption metadata not found');
      }

      // Request secure URL
      const response = await this.retryOperation<{ url: string }>(
        async () => {
          const result = await this.axiosInstance.get(`/documents/${documentId}/url`);
          return result.data;
        }
      );

      // Cache URL with short expiration
      await setStorageItem(
        `doc_${documentId}_url`,
        response.url,
        true,
        { expiration: 5 * 60 * 1000 } // 5 minutes
      );

      return response.url;
    } catch (error) {
      console.error('Failed to retrieve document URL:', error);
      throw error;
    }
  }

  /**
   * Securely deletes a document and associated metadata
   * @param documentId ID of the document to delete
   */
  public async deleteDocument(documentId: string): Promise<void> {
    try {
      // Delete document
      await this.retryOperation(
        async () => {
          await this.axiosInstance.delete(`/documents/${documentId}`);
        }
      );

      // Clean up local storage
      localStorage.removeItem(`${documentId}_key`);
      localStorage.removeItem(`${documentId}_url`);
    } catch (error) {
      console.error('Document deletion failed:', error);
      throw error;
    }
  }

  /**
   * Implements exponential backoff retry mechanism for operations
   * @param operation Function to retry
   * @returns Promise resolving to operation result
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.retryConfig.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
        this.retryConfig.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retryOperation(operation, attempt + 1);
    }
  }
}

export default StorageService;