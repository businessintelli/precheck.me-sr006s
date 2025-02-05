import { PrismaClient } from '@prisma/client'; // @version ^5.4.2
import { Redis } from 'ioredis'; // @version ^5.3.0
import {
  BackgroundCheck,
  BackgroundCheckType,
  BackgroundCheckStatus,
  VerificationResult,
  CreateBackgroundCheckDto
} from '../../types/background-check.types';
import { DocumentModel } from './document.model';
import { Logger } from '../../utils/logger';
import { BACKGROUND_CHECK_PACKAGES, CACHE_TTL_SECONDS } from '../../utils/constants';
import { NotFoundError, ValidationError } from '../../utils/errors';

/**
 * Enhanced model class for managing background check database operations
 * with improved security, performance, and error handling capabilities
 */
export class BackgroundCheckModel {
  private readonly prisma: PrismaClient;
  private readonly CACHE_PREFIX = 'background-check:';

  constructor(
    private readonly documentModel: DocumentModel,
    private readonly logger: Logger,
    private readonly redis: Redis
  ) {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'minimal'
    });
    this.setupErrorHandlers();
  }

  /**
   * Sets up error handlers for database connection monitoring
   */
  private setupErrorHandlers(): void {
    this.prisma.$on('error', (error) => {
      this.logger.error('Prisma Client Error:', {
        error: error.message,
        stack: error.stack
      });
    });
  }

  /**
   * Creates a new background check record with transaction support
   */
  async create(data: CreateBackgroundCheckDto): Promise<BackgroundCheck> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Validate package type and requirements
        if (!Object.keys(BACKGROUND_CHECK_PACKAGES).includes(data.type)) {
          throw new ValidationError('Invalid background check type', [{
            field: 'type',
            message: `Type must be one of: ${Object.keys(BACKGROUND_CHECK_PACKAGES).join(', ')}`
          }]);
        }

        const check = await tx.backgroundCheck.create({
          data: {
            type: data.type,
            status: BackgroundCheckStatus.INITIATED,
            candidateId: data.candidateId,
            organizationId: data.organizationId,
            metadata: data.metadata,
            initiatedAt: new Date(),
            expiresAt: this.calculateExpirationDate(data.type),
            verifications: [],
            results: []
          },
          include: {
            documents: true,
            interviews: true
          }
        });

        // Initialize required documents based on package type
        const requiredDocuments = BACKGROUND_CHECK_PACKAGES[data.type].required_documents;
        await this.documentModel.createMany(
          requiredDocuments.map(type => ({
            checkId: check.id,
            type,
            status: 'PENDING'
          }))
        );

        await this.cacheBackgroundCheck(check);
        
        this.logger.info('Background check created', {
          checkId: check.id,
          type: data.type,
          organizationId: data.organizationId
        });

        return check;
      });
    } catch (error) {
      this.logger.error('Error creating background check:', {
        error: error.message,
        data
      });
      throw error;
    }
  }

  /**
   * Retrieves a background check by ID with caching
   */
  async findById(id: string): Promise<BackgroundCheck | null> {
    try {
      // Check cache first
      const cached = await this.redis.get(`${this.CACHE_PREFIX}${id}`);
      if (cached) {
        return JSON.parse(cached);
      }

      const check = await this.prisma.backgroundCheck.findUnique({
        where: { id },
        include: {
          documents: true,
          interviews: true,
          verifications: true
        }
      });

      if (!check) {
        return null;
      }

      await this.cacheBackgroundCheck(check);
      return check;
    } catch (error) {
      this.logger.error('Error finding background check:', {
        error: error.message,
        id
      });
      throw error;
    }
  }

  /**
   * Updates a background check record with validation
   */
  async update(
    id: string,
    data: Partial<BackgroundCheck>
  ): Promise<BackgroundCheck> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingCheck = await tx.backgroundCheck.findUnique({
          where: { id }
        });

        if (!existingCheck) {
          throw new NotFoundError(`Background check not found: ${id}`);
        }

        const updatedCheck = await tx.backgroundCheck.update({
          where: { id },
          data: {
            ...data,
            updatedAt: new Date(),
            completedAt: data.status === BackgroundCheckStatus.COMPLETED ? new Date() : undefined
          },
          include: {
            documents: true,
            interviews: true
          }
        });

        await this.invalidateCache(id);
        
        this.logger.info('Background check updated', {
          checkId: id,
          status: updatedCheck.status
        });

        return updatedCheck;
      });
    } catch (error) {
      this.logger.error('Error updating background check:', {
        error: error.message,
        id,
        data
      });
      throw error;
    }
  }

  /**
   * Retrieves all background checks for an organization with pagination
   */
  async findByOrganization(
    organizationId: string,
    options: {
      page?: number;
      limit?: number;
      status?: BackgroundCheckStatus;
    } = {}
  ): Promise<{ data: BackgroundCheck[]; total: number }> {
    try {
      const { page = 1, limit = 20, status } = options;
      const skip = (page - 1) * limit;

      const [checks, total] = await Promise.all([
        this.prisma.backgroundCheck.findMany({
          where: {
            organizationId,
            ...(status && { status })
          },
          include: {
            documents: true,
            interviews: true
          },
          skip,
          take: limit,
          orderBy: {
            initiatedAt: 'desc'
          }
        }),
        this.prisma.backgroundCheck.count({
          where: {
            organizationId,
            ...(status && { status })
          }
        })
      ]);

      return { data: checks, total };
    } catch (error) {
      this.logger.error('Error finding background checks by organization:', {
        error: error.message,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Caches a background check record
   */
  private async cacheBackgroundCheck(check: BackgroundCheck): Promise<void> {
    await this.redis.set(
      `${this.CACHE_PREFIX}${check.id}`,
      JSON.stringify(check),
      'EX',
      CACHE_TTL_SECONDS
    );
  }

  /**
   * Invalidates cache for a background check
   */
  private async invalidateCache(id: string): Promise<void> {
    await this.redis.del(`${this.CACHE_PREFIX}${id}`);
  }

  /**
   * Calculates expiration date based on check type
   */
  private calculateExpirationDate(type: BackgroundCheckType): Date {
    const durationDays = BACKGROUND_CHECK_PACKAGES[type].duration_days;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + durationDays);
    return expirationDate;
  }
}