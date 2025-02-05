import { injectable } from 'tsyringe'; // @version ^4.7.0
import Bull from 'bull'; // @version ^4.10.0
import { Logger } from 'winston'; // @version ^3.8.0
import {
  Document,
  DocumentType,
  DocumentStatus,
  DocumentVerificationResult
} from '../../types/document.types';
import { DocumentVerificationService } from '../ai/document-verification.service';
import { RedisService } from '../cache/redis.service';
import { DOCUMENT_UPLOAD_CONFIG } from '../../utils/constants';

/**
 * Queue configuration interface for document processing
 */
interface QueueConfig {
  concurrency: number;
  attempts: number;
  backoff: {
    type: string;
    delay: number;
  };
}

/**
 * Enterprise-grade service for managing asynchronous document processing
 * with comprehensive error handling, monitoring, and caching capabilities.
 */
@injectable()
export class DocumentProcessorService {
  private readonly documentQueue: Bull.Queue;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly QUEUE_NAME = 'document-processing';

  constructor(
    private readonly verificationService: DocumentVerificationService,
    private readonly redisService: RedisService,
    private readonly logger: Logger,
    private readonly queueConfig: QueueConfig = {
      concurrency: 5,
      attempts: DOCUMENT_UPLOAD_CONFIG.RETRY_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: 1000
      }
    }
  ) {
    this.documentQueue = new Bull(this.QUEUE_NAME, {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: this.queueConfig.attempts,
        backoff: this.queueConfig.backoff,
        removeOnComplete: true,
        timeout: DOCUMENT_UPLOAD_CONFIG.VERIFICATION_TIMEOUT
      }
    });

    this.initializeQueue();
  }

  /**
   * Initializes the document processing queue with error handling and monitoring
   */
  private initializeQueue(): void {
    this.documentQueue.process(this.queueConfig.concurrency, async (job) => {
      return this.handleDocumentProcessing(job);
    });

    this.documentQueue.on('error', (error) => {
      this.logger.error('Document queue error', { error });
    });

    this.documentQueue.on('failed', (job, error) => {
      this.logger.error('Document processing failed', {
        jobId: job.id,
        documentId: job.data.id,
        error
      });
    });

    this.documentQueue.on('completed', (job) => {
      this.logger.info('Document processing completed', {
        jobId: job.id,
        documentId: job.data.id
      });
    });
  }

  /**
   * Queues a document for processing with priority handling
   */
  public async processDocument(document: Document): Promise<void> {
    try {
      this.logger.info('Queueing document for processing', {
        documentId: document.id,
        type: document.type
      });

      // Check if document is already being processed
      const existingStatus = await this.getDocumentStatus(document.id);
      if (existingStatus === DocumentStatus.PROCESSING) {
        throw new Error('Document is already being processed');
      }

      // Add document to processing queue with priority based on type
      const priority = this.getDocumentPriority(document.type);
      await this.documentQueue.add(document, {
        priority,
        jobId: document.id,
        removeOnComplete: true
      });

      // Update document status in cache
      await this.redisService.setEx(
        `document:${document.id}:status`,
        DocumentStatus.PROCESSING,
        this.CACHE_TTL
      );

    } catch (error) {
      this.logger.error('Failed to queue document', {
        documentId: document.id,
        error
      });
      throw error;
    }
  }

  /**
   * Handles the document processing workflow with comprehensive error handling
   */
  private async handleDocumentProcessing(job: Bull.Job<Document>): Promise<void> {
    const document = job.data;
    const processingStart = Date.now();

    try {
      this.logger.info('Starting document processing', {
        jobId: job.id,
        documentId: document.id
      });

      // Verify document using AI service
      const verificationResult = await this.verificationService.verifyDocument(document);

      // Update document status based on verification result
      const newStatus = this.determineDocumentStatus(verificationResult);
      await this.updateDocumentStatus(document.id, newStatus, verificationResult);

      // Log processing metrics
      const processingTime = Date.now() - processingStart;
      this.logger.info('Document processing completed', {
        jobId: job.id,
        documentId: document.id,
        processingTime,
        status: newStatus
      });

    } catch (error) {
      this.logger.error('Document processing failed', {
        jobId: job.id,
        documentId: document.id,
        error
      });

      // Handle failed processing
      await this.handleProcessingFailure(document.id, error);
      throw error;
    }
  }

  /**
   * Retrieves current document status with caching
   */
  public async getDocumentStatus(documentId: string): Promise<DocumentStatus> {
    try {
      // Check cache first
      const cachedStatus = await this.redisService.get<DocumentStatus>(
        `document:${documentId}:status`
      );

      if (cachedStatus) {
        return cachedStatus;
      }

      // If not in cache, get from queue
      const job = await this.documentQueue.getJob(documentId);
      if (!job) {
        return DocumentStatus.PENDING;
      }

      const jobState = await job.getState();
      return this.mapJobStateToStatus(jobState);

    } catch (error) {
      this.logger.error('Failed to get document status', {
        documentId,
        error
      });
      throw error;
    }
  }

  /**
   * Determines document priority based on type
   */
  private getDocumentPriority(type: DocumentType): number {
    const priorities: Record<DocumentType, number> = {
      [DocumentType.GOVERNMENT_ID]: 1,
      [DocumentType.PROOF_OF_ADDRESS]: 2,
      [DocumentType.EMPLOYMENT_RECORD]: 2,
      [DocumentType.EDUCATION_CERTIFICATE]: 3,
      [DocumentType.PROFESSIONAL_LICENSE]: 3,
      [DocumentType.BACKGROUND_CHECK_CONSENT]: 1
    };
    return priorities[type] || 3;
  }

  /**
   * Determines final document status based on verification result
   */
  private determineDocumentStatus(
    result: DocumentVerificationResult
  ): DocumentStatus {
    if (result.isAuthentic && result.confidenceScore >= 0.95) {
      return DocumentStatus.VERIFIED;
    } else if (result.confidenceScore >= 0.8) {
      return DocumentStatus.MANUAL_REVIEW_REQUIRED;
    }
    return DocumentStatus.REJECTED;
  }

  /**
   * Updates document status with caching
   */
  private async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    result?: DocumentVerificationResult
  ): Promise<void> {
    try {
      // Update cache
      await this.redisService.setEx(
        `document:${documentId}:status`,
        status,
        this.CACHE_TTL
      );

      if (result) {
        await this.redisService.setEx(
          `document:${documentId}:result`,
          result,
          this.CACHE_TTL
        );
      }

    } catch (error) {
      this.logger.error('Failed to update document status', {
        documentId,
        status,
        error
      });
      throw error;
    }
  }

  /**
   * Handles processing failures with appropriate error handling
   */
  private async handleProcessingFailure(
    documentId: string,
    error: Error
  ): Promise<void> {
    await this.updateDocumentStatus(documentId, DocumentStatus.ERROR);
    this.logger.error('Document processing failed', {
      documentId,
      error: error.message,
      stack: error.stack
    });
  }

  /**
   * Maps Bull job states to document statuses
   */
  private mapJobStateToStatus(state: string): DocumentStatus {
    const stateMap: Record<string, DocumentStatus> = {
      'waiting': DocumentStatus.PENDING,
      'active': DocumentStatus.PROCESSING,
      'completed': DocumentStatus.VERIFIED,
      'failed': DocumentStatus.ERROR,
      'delayed': DocumentStatus.PENDING
    };
    return stateMap[state] || DocumentStatus.PENDING;
  }
}