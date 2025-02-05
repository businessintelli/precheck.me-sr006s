import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'; // ^3.0.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { Counter, Histogram } from 'prom-client'; // ^14.0.0
import { KmsKeyringNode, buildClient, CommitmentPolicy } from '@aws-crypto/client-node'; // ^3.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { createHash } from 'crypto';
import { Readable } from 'stream';

import { storageConfig } from '../../config/storage.config';
import { logger } from '../../utils/logger';
import { ValidationError, InternalServerError } from '../../utils/errors';
import { DocumentStatus } from '../../types/document.types';

/**
 * Interface for upload result with comprehensive metadata
 */
interface UploadResult {
  key: string;
  url: string;
  checksum: string;
  metadata: {
    contentType: string;
    size: number;
    encrypted: boolean;
    uploadedAt: string;
    hash: string;
  };
}

/**
 * Interface for download result including verification data
 */
interface DownloadResult {
  buffer: Buffer;
  metadata: {
    contentType: string;
    size: number;
    checksum: string;
    encrypted: boolean;
  };
}

/**
 * Enhanced storage service with comprehensive security features
 * @version 1.0.0
 */
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly encryptionClient: any;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly uploadCounter: Counter;
  private readonly operationDuration: Histogram;

  constructor() {
    // Initialize S3 client with secure configuration
    this.s3Client = new S3Client({
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
      maxAttempts: storageConfig.retryConfig?.maxAttempts || 3
    });

    // Initialize encryption client with KMS
    const keyring = new KmsKeyringNode({ generatorKeyId: storageConfig.encryptionKey });
    this.encryptionClient = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);

    // Configure circuit breaker for resilient operations
    this.circuitBreaker = new CircuitBreaker(async (operation: Function) => operation(), {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    // Initialize metrics
    this.uploadCounter = new Counter({
      name: 'storage_uploads_total',
      help: 'Total number of file uploads'
    });

    this.operationDuration = new Histogram({
      name: 'storage_operation_duration_seconds',
      help: 'Duration of storage operations',
      labelNames: ['operation']
    });
  }

  /**
   * Securely uploads a document with encryption and validation
   */
  public async uploadDocument(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata: Record<string, string>
  ): Promise<UploadResult> {
    const timer = this.operationDuration.startTimer({ operation: 'upload' });

    try {
      // Validate document properties
      await this.validateDocument(fileBuffer, mimeType);

      // Generate secure file key
      const fileKey = `${uuidv4()}/${fileName}`;
      const checksum = this.calculateChecksum(fileBuffer);

      // Encrypt file content
      const { result: encryptedData } = await this.encryptionClient.encrypt(
        fileBuffer,
        { encryptionContext: { fileKey, checksum } }
      );

      // Upload to S3 with retry mechanism
      const uploadResult = await this.circuitBreaker.fire(async () => {
        return this.s3Client.send(new PutObjectCommand({
          Bucket: storageConfig.bucketName,
          Key: fileKey,
          Body: encryptedData,
          ContentType: mimeType,
          Metadata: {
            ...metadata,
            checksum,
            encrypted: 'true',
            originalSize: fileBuffer.length.toString()
          }
        }));
      });

      if (!uploadResult) {
        throw new InternalServerError('Failed to upload document');
      }

      // Log successful upload
      logger.info('Document uploaded successfully', {
        fileKey,
        size: fileBuffer.length,
        mimeType
      });

      // Update metrics
      this.uploadCounter.inc();
      timer();

      return {
        key: fileKey,
        url: `https://${storageConfig.bucketName}.s3.${storageConfig.region}.amazonaws.com/${fileKey}`,
        checksum,
        metadata: {
          contentType: mimeType,
          size: fileBuffer.length,
          encrypted: true,
          uploadedAt: new Date().toISOString(),
          hash: checksum
        }
      };
    } catch (error) {
      logger.error('Document upload failed', { error });
      throw error;
    }
  }

  /**
   * Securely downloads and verifies a document
   */
  public async downloadDocument(fileKey: string): Promise<DownloadResult> {
    const timer = this.operationDuration.startTimer({ operation: 'download' });

    try {
      // Download encrypted file
      const downloadResult = await this.circuitBreaker.fire(async () => {
        return this.s3Client.send(new GetObjectCommand({
          Bucket: storageConfig.bucketName,
          Key: fileKey
        }));
      });

      if (!downloadResult?.Body) {
        throw new InternalServerError('Failed to download document');
      }

      // Convert stream to buffer
      const encryptedBuffer = await this.streamToBuffer(downloadResult.Body as Readable);

      // Decrypt file content
      const { plaintext, messageHeader } = await this.encryptionClient.decrypt(encryptedBuffer);

      // Verify file integrity
      const checksum = this.calculateChecksum(plaintext);
      if (checksum !== downloadResult.Metadata?.checksum) {
        throw new ValidationError('Document integrity check failed', [{
          field: 'checksum',
          message: 'Checksum mismatch detected'
        }]);
      }

      timer();

      return {
        buffer: plaintext,
        metadata: {
          contentType: downloadResult.ContentType || 'application/octet-stream',
          size: plaintext.length,
          checksum,
          encrypted: true
        }
      };
    } catch (error) {
      logger.error('Document download failed', { error, fileKey });
      throw error;
    }
  }

  /**
   * Validates document properties and security requirements
   */
  private async validateDocument(fileBuffer: Buffer, mimeType: string): Promise<void> {
    const validationErrors = [];

    // Check file size
    if (fileBuffer.length > storageConfig.maxFileSize) {
      validationErrors.push({
        field: 'size',
        message: `File size exceeds maximum allowed size of ${storageConfig.maxFileSize} bytes`
      });
    }

    // Validate mime type
    if (!storageConfig.allowedMimeTypes.includes(mimeType)) {
      validationErrors.push({
        field: 'mimeType',
        message: `Invalid mime type. Allowed types: ${storageConfig.allowedMimeTypes.join(', ')}`
      });
    }

    // Perform basic virus scan (implementation would integrate with actual antivirus service)
    const isMalicious = await this.scanForMalware(fileBuffer);
    if (isMalicious) {
      validationErrors.push({
        field: 'security',
        message: 'Potential security threat detected in file'
      });
    }

    if (validationErrors.length > 0) {
      throw new ValidationError('Document validation failed', validationErrors);
    }
  }

  /**
   * Calculates SHA-256 checksum of file content
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Converts readable stream to buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Performs malware scan on file content
   * Note: This is a placeholder for actual antivirus integration
   */
  private async scanForMalware(buffer: Buffer): Promise<boolean> {
    // Implementation would integrate with actual antivirus service
    return false;
  }
}