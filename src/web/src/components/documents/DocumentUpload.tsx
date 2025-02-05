/**
 * Enhanced document upload component with security features, accessibility, and validation
 * Implements client-side encryption, chunked uploads, and comprehensive validation
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'; // ^18.0.0
import { useDropzone } from 'react-dropzone'; // ^14.0.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import compressImage from 'browser-image-compression'; // ^2.0.0
import { fileValidation } from '@security/file-validation'; // ^1.0.0
import { Document, DocumentType, DocumentStatus, DocumentValidation } from '../../types/document.types';
import { useDocument } from '../../hooks/useDocument';

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_FILE_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.heic'];
const MAX_RETRY_ATTEMPTS = 3;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';

// Types and interfaces
interface DocumentUploadProps {
  checkId: string;
  documentType: DocumentType;
  maxSize?: number;
  acceptedFileTypes?: string[];
  autoUpload?: boolean;
  compressionOptions?: {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    useWebWorker: boolean;
  };
  encryptionKey?: string;
  chunkSize?: number;
  retryAttempts?: number;
  onUploadComplete?: (document: Document) => void;
  onUploadError?: (error: Error) => void;
  onUploadProgress?: (progress: number) => void;
}

interface FileWithPreview extends File {
  preview?: string;
}

/**
 * Enhanced document upload component with comprehensive security features
 */
const DocumentUpload: React.FC<DocumentUploadProps> = ({
  checkId,
  documentType,
  maxSize = MAX_FILE_SIZE,
  acceptedFileTypes = ACCEPTED_FILE_TYPES,
  autoUpload = true,
  compressionOptions = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  },
  encryptionKey,
  chunkSize = CHUNK_SIZE,
  retryAttempts = MAX_RETRY_ATTEMPTS,
  onUploadComplete,
  onUploadError,
  onUploadProgress
}) => {
  // State management
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const uploadCancelRef = useRef<boolean>(false);

  // Custom hooks
  const {
    uploadDocument,
    cancelUpload,
    retryUpload,
    isUploading,
    uploadProgress,
    uploadSpeed,
    timeRemaining
  } = useDocument(checkId);

  /**
   * Handles file drop with validation and preprocessing
   */
  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      if (acceptedFiles.length === 0) return;
      
      const file = acceptedFiles[0];
      setValidationErrors([]);

      // Validate file
      const validation = await fileValidation(file, {
        maxSize,
        allowedTypes: acceptedFileTypes,
        validateChecksum: true,
        scanMalware: true
      });

      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        return;
      }

      // Compress image if applicable
      let processedFile: FileWithPreview = file;
      if (file.type.startsWith('image/') && !file.type.includes('gif')) {
        setIsCompressing(true);
        try {
          const compressedFile = await compressImage(file, compressionOptions);
          processedFile = Object.assign(compressedFile, {
            preview: URL.createObjectURL(compressedFile)
          });
        } finally {
          setIsCompressing(false);
        }
      }

      // Set preview for non-image files
      if (!processedFile.preview && file.type === 'application/pdf') {
        processedFile.preview = '/assets/pdf-preview.svg';
      }

      setSelectedFile(processedFile);

      // Auto upload if enabled
      if (autoUpload) {
        handleUpload();
      }
    } catch (error) {
      console.error('File drop handling failed:', error);
      onUploadError?.(error as Error);
    }
  }, [maxSize, acceptedFileTypes, autoUpload, compressionOptions]);

  /**
   * Configures dropzone with accessibility and validation
   */
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept: acceptedFileTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize,
    multiple: false,
    disabled: isUploading,
    onDropRejected: (rejections) => {
      const errors = rejections.flatMap(rejection => 
        rejection.errors.map(error => error.message)
      );
      setValidationErrors(errors);
    }
  });

  /**
   * Handles secure file upload with chunking and encryption
   */
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    
    try {
      uploadCancelRef.current = false;
      setValidationErrors([]);

      // Generate encryption key if not provided
      const key = encryptionKey || CryptoJS.lib.WordArray.random(32).toString();
      
      // Upload with progress tracking
      const document = await uploadDocument(selectedFile, documentType, {
        onProgress: (progress) => {
          if (uploadCancelRef.current) return;
          onUploadProgress?.(progress);
        },
        chunkSize,
        encryptionKey: key
      });

      onUploadComplete?.(document);
    } catch (error) {
      console.error('Upload failed:', error);
      if (retryCount < retryAttempts) {
        setRetryCount(prev => prev + 1);
        await handleRetry();
      } else {
        onUploadError?.(error as Error);
      }
    }
  }, [selectedFile, documentType, encryptionKey, chunkSize, retryAttempts]);

  /**
   * Handles upload retry with exponential backoff
   */
  const handleRetry = useCallback(async () => {
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    try {
      await retryUpload();
    } catch (error) {
      console.error('Retry failed:', error);
      onUploadError?.(error as Error);
    }
  }, [retryCount, retryUpload]);

  /**
   * Handles upload cancellation
   */
  const handleCancel = useCallback(async () => {
    uploadCancelRef.current = true;
    await cancelUpload();
    setSelectedFile(null);
    setRetryCount(0);
  }, [cancelUpload]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (selectedFile?.preview) {
        URL.revokeObjectURL(selectedFile.preview);
      }
    };
  }, [selectedFile]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps({
          className: `relative border-2 border-dashed rounded-lg p-6 text-center
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
            ${isDragReject ? 'border-red-500 bg-red-50' : ''}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `
        })}
      >
        <input {...getInputProps()} aria-label="File upload input" />
        
        {isCompressing ? (
          <div className="text-gray-600">Compressing file...</div>
        ) : selectedFile ? (
          <div className="space-y-4">
            {selectedFile.preview && (
              <img
                src={selectedFile.preview}
                alt="File preview"
                className="mx-auto max-h-48 object-contain"
              />
            )}
            <div className="text-sm text-gray-600">
              {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600">
              Drag and drop your file here, or click to select
            </p>
            <p className="text-sm text-gray-500">
              Supported formats: {acceptedFileTypes.join(', ')}
            </p>
            <p className="text-sm text-gray-500">
              Maximum size: {(maxSize / 1024 / 1024).toFixed(0)} MB
            </p>
          </div>
        )}
      </div>

      {validationErrors.length > 0 && (
        <div className="mt-2 text-sm text-red-600" role="alert">
          {validationErrors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      {isUploading && (
        <div className="mt-4 space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>{uploadProgress}% complete</span>
            <span>{uploadSpeed ? `${(uploadSpeed / 1024 / 1024).toFixed(2)} MB/s` : ''}</span>
          </div>
          <button
            onClick={handleCancel}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Cancel Upload
          </button>
        </div>
      )}

      {selectedFile && !autoUpload && !isUploading && (
        <button
          onClick={handleUpload}
          className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded-lg
            hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Upload File
        </button>
      )}
    </div>
  );
};

export default DocumentUpload;