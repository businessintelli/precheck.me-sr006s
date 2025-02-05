// @package axios version ^1.6.0
// @package winston version ^3.11.0

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger, createLogger, format, transports } from 'winston';
import { Organization } from '../../types/organization.types';
import { User } from '../../types/user.types';
import { CircuitBreaker, RateLimiter, Cache, MetricsCollector, WebhookManager } from './utils';

// Constants for configuration and defaults
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const SYNC_INTERVAL = 3600000;
const CACHE_TTL = 3600;
const RATE_LIMIT_WINDOW = 60000;
const CIRCUIT_BREAKER_THRESHOLD = 0.5;
const MAX_BATCH_SIZE = 1000;
const API_VERSION = 'v1';

// Interface definitions
export interface HRISConfig {
  apiUrl: string;
  apiKey: string;
  organizationId: string;
  requestTimeout: number;
  maxRetryAttempts: number;
  rateLimitPerMinute: number;
  enableCache: boolean;
  cacheTTLSeconds: number;
  apiVersion: string;
  customHeaders: Record<string, string>;
}

export interface EmploymentVerificationRequest {
  candidateId: string;
  employerName: string;
  startDate: string;
  endDate: string;
  position: string;
  additionalDetails: Record<string, any>;
  includePayrollData: boolean;
  requiredFields: string[];
}

export interface EmploymentVerificationResponse {
  verified: boolean;
  employerName: string;
  startDate: string;
  endDate: string;
  position: string;
  verificationDate: string;
  verificationSource: string;
  payrollData?: Record<string, any>;
  verificationHistory: Array<{
    timestamp: string;
    status: string;
    source: string;
  }>;
  metadata: Record<string, any>;
}

@Injectable()
@CircuitBreaker({
  threshold: CIRCUIT_BREAKER_THRESHOLD,
  windowMs: RATE_LIMIT_WINDOW
})
@Metrics()
export class HRISService {
  private readonly logger: Logger;
  private readonly client: AxiosInstance;
  private readonly config: HRISConfig;
  private readonly verificationCache: Cache;
  private readonly rateLimiter: RateLimiter;
  private readonly metrics: MetricsCollector;
  private readonly webhookManager: WebhookManager;

  constructor(
    config: HRISConfig,
    metricsConfig: MetricsConfig,
    cacheConfig: CacheConfig
  ) {
    // Initialize logger with correlation IDs
    this.logger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.json(),
        format.correlationId()
      ),
      transports: [new transports.Console()]
    });

    // Initialize configuration with defaults
    this.config = {
      requestTimeout: DEFAULT_TIMEOUT,
      maxRetryAttempts: MAX_RETRY_ATTEMPTS,
      ...config
    };

    // Initialize HTTP client with interceptors
    this.client = axios.create({
      baseURL: `${this.config.apiUrl}/api/${this.config.apiVersion}`,
      timeout: this.config.requestTimeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...this.config.customHeaders
      }
    });

    // Add request interceptor for timing and logging
    this.client.interceptors.request.use((config) => {
      config.metadata = { startTime: Date.now() };
      this.logger.info('Outgoing HRIS request', { 
        url: config.url,
        method: config.method
      });
      return config;
    });

    // Add response interceptor for metrics and error handling
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        this.metrics.recordRequestDuration(duration);
        return response;
      },
      (error: AxiosError) => {
        this.handleRequestError(error);
        return Promise.reject(error);
      }
    );

    // Initialize supporting services
    this.verificationCache = new Cache(cacheConfig);
    this.rateLimiter = new RateLimiter({
      windowMs: RATE_LIMIT_WINDOW,
      maxRequests: this.config.rateLimitPerMinute
    });
    this.metrics = new MetricsCollector(metricsConfig);
    this.webhookManager = new WebhookManager();
  }

  @LogMethodCall()
  @RateLimit()
  @CircuitBreaker()
  @ValidateInput()
  public async verifyEmployment(
    request: EmploymentVerificationRequest
  ): Promise<EmploymentVerificationResponse> {
    try {
      // Check cache first
      const cacheKey = this.generateVerificationCacheKey(request);
      const cachedResult = await this.verificationCache.get(cacheKey);
      if (cachedResult) {
        this.logger.debug('Cache hit for employment verification', { cacheKey });
        return cachedResult;
      }

      // Apply rate limiting
      await this.rateLimiter.checkLimit(this.config.organizationId);

      // Make API request with retry logic
      const response = await this.makeRequestWithRetry('/verify/employment', {
        method: 'POST',
        data: request
      });

      // Transform and validate response
      const verificationResult = this.transformVerificationResponse(response.data);

      // Cache successful result
      if (verificationResult.verified) {
        await this.verificationCache.set(
          cacheKey,
          verificationResult,
          this.config.cacheTTLSeconds
        );
      }

      // Log verification attempt
      this.logger.info('Employment verification completed', {
        candidateId: request.candidateId,
        verified: verificationResult.verified
      });

      return verificationResult;
    } catch (error) {
      this.logger.error('Employment verification failed', {
        error: error.message,
        candidateId: request.candidateId
      });
      throw error;
    }
  }

  @LogMethodCall()
  @BackgroundTask()
  @TransactionBoundary()
  public async syncEmployeeData(
    organizationId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const syncStats = {
      totalRecords: 0,
      processedRecords: 0,
      failedRecords: 0,
      startTime: Date.now()
    };

    try {
      // Validate organization access
      const organization = await this.validateOrganizationAccess(organizationId);

      // Initialize sync process
      const syncId = this.generateSyncId();
      this.logger.info('Starting employee data sync', { 
        syncId,
        organizationId 
      });

      // Determine sync strategy
      const lastSyncTime = await this.getLastSyncTime(organizationId);
      const syncStrategy = options.fullSync ? 'full' : 'delta';

      // Fetch and process employee data in batches
      let hasMoreData = true;
      let page = 1;

      while (hasMoreData) {
        const employeeData = await this.fetchEmployeeBatch(
          organization,
          page,
          lastSyncTime
        );

        if (employeeData.length === 0) {
          hasMoreData = false;
          continue;
        }

        // Process batch with transaction
        await this.processBatch(employeeData, syncStats);
        page++;
      }

      // Update sync metadata
      await this.updateSyncMetadata(organizationId, syncStats);

      // Trigger webhooks if configured
      await this.webhookManager.notifySyncComplete(organizationId, syncStats);

      return {
        ...syncStats,
        duration: Date.now() - syncStats.startTime,
        status: 'completed'
      };
    } catch (error) {
      this.logger.error('Employee data sync failed', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }

  private async makeRequestWithRetry(
    endpoint: string,
    config: any,
    attempt = 1
  ): Promise<any> {
    try {
      return await this.client.request({
        url: endpoint,
        ...config
      });
    } catch (error) {
      if (
        attempt < this.config.maxRetryAttempts &&
        this.shouldRetry(error)
      ) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return this.makeRequestWithRetry(endpoint, config, attempt + 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: AxiosError): boolean {
    return (
      error.response?.status === 429 ||
      error.response?.status === 503 ||
      error.code === 'ECONNRESET'
    );
  }

  private handleRequestError(error: AxiosError): void {
    const errorContext = {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method
    };

    if (error.response?.status === 429) {
      this.metrics.incrementRateLimitHit();
      this.logger.warn('Rate limit exceeded', errorContext);
    } else {
      this.metrics.incrementErrorCount();
      this.logger.error('HRIS request failed', {
        ...errorContext,
        error: error.message
      });
    }
  }

  private generateVerificationCacheKey(request: EmploymentVerificationRequest): string {
    return `verification:${request.candidateId}:${request.employerName}`;
  }

  private transformVerificationResponse(
    data: any
  ): EmploymentVerificationResponse {
    return {
      verified: data.verified,
      employerName: data.employer_name,
      startDate: data.start_date,
      endDate: data.end_date,
      position: data.position,
      verificationDate: new Date().toISOString(),
      verificationSource: 'HRIS',
      payrollData: data.payroll_data,
      verificationHistory: data.verification_history || [],
      metadata: data.metadata || {}
    };
  }
}