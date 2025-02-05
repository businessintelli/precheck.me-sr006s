import { injectable } from 'inversify';
import Bull from 'bull'; // @version ^4.10.0
import Redis from 'ioredis'; // @version ^5.3.0
import { Counter, Histogram } from 'prom-client'; // @version ^14.0.0
import { 
  BackgroundCheck, 
  BackgroundCheckStatus, 
  VerificationResult 
} from '../../types/background-check.types';
import { DocumentVerificationService } from '../ai/document-verification.service';
import { NotificationService } from './notification.service';
import { Logger } from '../../utils/logger';
import { InternalServerError } from '../../utils/errors';

/**
 * Priority levels for verification jobs
 */
enum VerificationPriority {
  HIGH = 1,
  MEDIUM = 5,
  LOW = 10
}

/**
 * Interface for verification job options
 */
interface VerificationJobOptions {
  priority: VerificationPriority;
  attempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

/**
 * Enhanced service for managing background check verifications with performance monitoring
 */
@injectable()
export class VerificationWorkerService {
  private readonly verificationQueue: Bull.Queue<BackgroundCheck>;
  private readonly verificationCounter: Counter;
  private readonly processingDuration: Histogram;
  private readonly logger: Logger;

  constructor(
    private readonly documentVerificationService: DocumentVerificationService,
    private readonly notificationService: NotificationService,
    private readonly redisClient: Redis
  ) {
    this.logger = new Logger('VerificationWorkerService');
    this.initializeMetrics();
    this.initializeQueue();
  }

  /**
   * Initializes performance metrics
   */
  private initializeMetrics(): void {
    this.verificationCounter = new Counter({
      name: 'background_check_verifications_total',
      help: 'Total number of background check verifications processed',
      labelNames: ['status', 'type']
    });

    this.processingDuration = new Histogram({
      name: 'background_check_processing_duration_seconds',
      help: 'Duration of background check processing',
      buckets: [30, 60, 120, 300, 600]
    });
  }

  /**
   * Initializes verification queue with optimized settings
   */
  private initializeQueue(): void {
    this.verificationQueue = new Bull('background-check-verification', {
      redis: {
        client: this.redisClient,
        maxRetriesPerRequest: 3
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    this.verificationQueue.process(10, async (job) => {
      const timer = this.processingDuration.startTimer();
      try {
        await this.processVerification(job);
      } finally {
        timer();
      }
    });

    this.setupQueueEventHandlers();
  }

  /**
   * Sets up event handlers for queue monitoring
   */
  private setupQueueEventHandlers(): void {
    this.verificationQueue.on('error', (error) => {
      this.logger.error('Queue error occurred', { error });
    });

    this.verificationQueue.on('failed', (job, error) => {
      this.logger.error('Job failed', { jobId: job.id, error });
    });

    this.verificationQueue.on('completed', (job) => {
      this.verificationCounter.inc({ 
        status: 'completed',
        type: job.data.type
      });
    });
  }

  /**
   * Processes a background check verification with parallel document processing
   */
  private async processVerification(job: Bull.Job<BackgroundCheck>): Promise<void> {
    const { id, documents, type } = job.data;
    
    try {
      await job.progress(10);
      await this.updateCheckStatus(id, BackgroundCheckStatus.VERIFICATION_IN_PROGRESS);

      // Process documents in parallel
      const documentVerifications = await Promise.all(
        documents.map(async (docId) => {
          const document = await this.fetchDocument(docId);
          return this.documentVerificationService.verifyDocument(document);
        })
      );

      await job.progress(50);

      // Analyze verification results
      const verificationResult = this.analyzeResults(documentVerifications);
      const status = this.determineCheckStatus(verificationResult);

      // Update check status and results
      await this.updateCheckStatus(id, status);
      await this.storeVerificationResults(id, verificationResult);

      await job.progress(100);

      // Send notifications
      await this.notificationService.sendBackgroundCheckNotification(
        job.data.candidateId,
        {
          id,
          status,
          details: verificationResult
        }
      );

      this.logger.info('Verification completed successfully', { checkId: id });
    } catch (error) {
      this.logger.error('Verification processing failed', { error, checkId: id });
      throw new InternalServerError('Verification processing failed');
    }
  }

  /**
   * Queues a new background check verification with priority handling
   */
  public async queueVerification(
    backgroundCheck: BackgroundCheck,
    priority: VerificationPriority = VerificationPriority.MEDIUM
  ): Promise<Bull.Job<BackgroundCheck>> {
    try {
      const jobOptions: VerificationJobOptions = {
        priority,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      };

      const job = await this.verificationQueue.add(backgroundCheck, jobOptions);
      
      this.logger.info('Verification queued successfully', { 
        checkId: backgroundCheck.id,
        jobId: job.id
      });

      return job;
    } catch (error) {
      this.logger.error('Failed to queue verification', { error });
      throw new InternalServerError('Failed to queue verification');
    }
  }

  /**
   * Retries a failed verification with exponential backoff
   */
  public async retryFailedVerification(
    backgroundCheckId: string
  ): Promise<Bull.Job<BackgroundCheck>> {
    try {
      const failedJob = await this.findFailedJob(backgroundCheckId);
      if (!failedJob) {
        throw new Error('Failed job not found');
      }

      await this.updateCheckStatus(backgroundCheckId, BackgroundCheckStatus.INITIATED);
      
      return this.queueVerification(failedJob.data, VerificationPriority.HIGH);
    } catch (error) {
      this.logger.error('Failed to retry verification', { error });
      throw new InternalServerError('Failed to retry verification');
    }
  }

  /**
   * Finds a failed job by background check ID
   */
  private async findFailedJob(backgroundCheckId: string): Promise<Bull.Job<BackgroundCheck> | null> {
    const failed = await this.verificationQueue.getFailed();
    return failed.find(job => job.data.id === backgroundCheckId) || null;
  }

  /**
   * Updates background check status with optimistic locking
   */
  private async updateCheckStatus(
    checkId: string,
    status: BackgroundCheckStatus
  ): Promise<void> {
    const key = `background-check:${checkId}:status`;
    const result = await this.redisClient
      .multi()
      .get(key)
      .set(key, status)
      .exec();

    if (!result) {
      throw new Error('Failed to update check status');
    }
  }

  /**
   * Stores verification results with proper indexing
   */
  private async storeVerificationResults(
    checkId: string,
    results: VerificationResult[]
  ): Promise<void> {
    const key = `background-check:${checkId}:results`;
    await this.redisClient.set(key, JSON.stringify(results));
  }

  /**
   * Analyzes verification results to determine overall status
   */
  private analyzeResults(results: VerificationResult[]): VerificationResult[] {
    // Implementation would include comprehensive result analysis
    return results;
  }

  /**
   * Determines final check status based on verification results
   */
  private determineCheckStatus(results: VerificationResult[]): BackgroundCheckStatus {
    const allVerified = results.every(result => result.verified);
    return allVerified ? 
      BackgroundCheckStatus.COMPLETED : 
      BackgroundCheckStatus.REJECTED;
  }

  /**
   * Fetches document details from storage
   */
  private async fetchDocument(docId: string): Promise<any> {
    // Implementation would include document fetching logic
    throw new Error('Method not implemented');
  }
}