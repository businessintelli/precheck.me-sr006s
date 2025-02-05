/**
 * Enhanced React hook for secure document operations in the Precheck.me platform
 * Implements client-side encryption, real-time status tracking, and comprehensive document management
 * @version 1.0.0
 */

import { useState, useCallback, useEffect } from 'react'; // ^18.0.0
import useWebSocket from 'react-use-websocket'; // ^4.0.0
import SecurityService from '@precheck/security'; // ^1.0.0
import { Document, DocumentType, DocumentStatus } from '../types/document.types';
import { ApiService } from '../services/api.service';
import StorageService from '../services/storage.service';

// Constants
const DOCUMENT_POLL_INTERVAL = 5000;
const MAX_UPLOAD_SIZE = 10485760; // 10MB
const MAX_RETRY_ATTEMPTS = 3;
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';
const CHUNK_SIZE = 1048576; // 1MB

// Types
interface DocumentOptions {
  pollInterval?: number;
  autoVerify?: boolean;
  securityLevel?: 'standard' | 'high';
}

interface UploadOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  chunkSize?: number;
}

interface SecurityContext {
  encryptionType: string;
  keyId: string;
  verified: boolean;
}

interface DocumentError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Custom hook for secure document management
 * @param checkId - Background check ID associated with documents
 * @param options - Configuration options for document handling
 */
export function useDocument(checkId: string, options: DocumentOptions = {}) {
  // State management
  const [document, setDocument] = useState<Document | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<DocumentError | null>(null);
  const [securityContext, setSecurityContext] = useState<SecurityContext | null>(null);

  // Service instances
  const storageService = new StorageService();
  const securityService = new SecurityService();

  // WebSocket setup for real-time updates
  const { lastMessage } = useWebSocket(`${process.env.NEXT_PUBLIC_WS_URL}/documents/${checkId}`, {
    shouldReconnect: true,
    reconnectInterval: 3000,
    reconnectAttempts: 5,
  });

  /**
   * Handles document upload with encryption and chunked transfer
   */
  const uploadDocument = useCallback(async (
    file: File,
    type: DocumentType,
    uploadOptions: UploadOptions = {}
  ): Promise<Document> => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      // Generate encryption key and context
      const securityCtx = await securityService.createEncryptionContext({
        algorithm: ENCRYPTION_ALGORITHM,
        keySize: 256,
      });

      // Initialize upload
      const uploadResponse = await ApiService.post('/documents/initiate', {
        checkId,
        type,
        fileName: file.name,
        fileSize: file.size,
        securityContext: securityCtx.id,
      });

      // Upload encrypted chunks
      const chunkSize = uploadOptions.chunkSize || CHUNK_SIZE;
      const chunks = Math.ceil(file.size / chunkSize);
      
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Encrypt chunk
        const encryptedChunk = await securityService.encryptData(chunk, securityCtx);
        
        // Upload chunk
        await storageService.uploadEncryptedDocument(
          encryptedChunk,
          uploadResponse.uploadUrl,
          i,
          chunks
        );

        // Update progress
        const progress = Math.round(((i + 1) / chunks) * 100);
        setUploadProgress(progress);
        uploadOptions.onProgress?.(progress);
      }

      // Verify upload
      const document = await ApiService.post(`/documents/${uploadResponse.documentId}/verify`, {
        checksum: await securityService.generateChecksum(file),
      });

      setDocument(document);
      setSecurityContext({
        encryptionType: ENCRYPTION_ALGORITHM,
        keyId: securityCtx.id,
        verified: true,
      });

      return document;
    } catch (error) {
      const documentError: DocumentError = {
        code: 'UPLOAD_FAILED',
        message: error.message,
        details: error.details,
      };
      setError(documentError);
      uploadOptions.onError?.(error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [checkId]);

  /**
   * Cancels ongoing document upload
   */
  const cancelUpload = useCallback(async (): Promise<void> => {
    if (isUploading && document) {
      await storageService.cancelUpload(document.id);
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [isUploading, document]);

  /**
   * Updates document status from WebSocket or polling
   */
  const updateDocumentStatus = useCallback(async () => {
    if (!document) return;

    try {
      const updatedDocument = await ApiService.get(`/documents/${document.id}`);
      setDocument(updatedDocument);

      // Verify document integrity if needed
      if (updatedDocument.status === DocumentStatus.VERIFIED && securityContext) {
        const isValid = await securityService.verifyDocument(
          updatedDocument.id,
          securityContext.keyId
        );
        
        setSecurityContext(prev => prev ? { ...prev, verified: isValid } : null);
      }
    } catch (error) {
      console.error('Failed to update document status:', error);
    }
  }, [document, securityContext]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      if (data.documentId === document?.id) {
        setDocument(prev => ({ ...prev!, ...data.updates }));
      }
    }
  }, [lastMessage, document]);

  // Polling fallback for status updates
  useEffect(() => {
    const pollInterval = options.pollInterval || DOCUMENT_POLL_INTERVAL;
    let pollTimer: NodeJS.Timeout;

    if (document && document.status !== DocumentStatus.VERIFIED) {
      pollTimer = setInterval(updateDocumentStatus, pollInterval);
    }

    return () => {
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [document, options.pollInterval, updateDocumentStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (securityContext) {
        securityService.clearEncryptionContext(securityContext.keyId);
      }
    };
  }, [securityContext]);

  return {
    document,
    uploadDocument,
    cancelUpload,
    isUploading,
    uploadProgress,
    error,
    securityContext,
  };
}