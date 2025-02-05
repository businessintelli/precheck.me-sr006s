import { injectable } from 'tsyringe'; // @version ^4.8.0
import { 
  Controller, Post, Get, Put, Param, Body, 
  UseGuards, UseInterceptors 
} from '@nestjs/common'; // @version ^10.0.0
import { 
  ApiTags, ApiOperation, ApiResponse, ApiSecurity 
} from '@nestjs/swagger'; // @version ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // @version ^5.0.0

import { BackgroundCheckService } from '../services/background-check.service';
import { CreateBackgroundCheckDto, validateCreateBackgroundCheckDto } from '../dto/create-check.dto';
import { BackgroundCheck, BackgroundCheckStatus } from '../../../types/background-check.types';
import { AuthGuard, RoleGuard } from '../../../guards/auth.guard';
import { LoggingInterceptor } from '../../../interceptors/logging.interceptor';
import { MonitoringInterceptor } from '../../../interceptors/monitoring.interceptor';
import { ValidationError, NotFoundError } from '../../../utils/errors';
import { secureLogger as logger } from '../../../utils/logger';
import { API_RATE_LIMITS } from '../../../utils/constants';

/**
 * Controller handling background check operations with comprehensive security,
 * validation, and monitoring features.
 */
@injectable()
@Controller('api/background-checks')
@ApiTags('Background Checks')
@UseGuards(AuthGuard, RoleGuard)
@UseInterceptors(LoggingInterceptor, MonitoringInterceptor)
export class BackgroundCheckController {
  constructor(
    private readonly backgroundCheckService: BackgroundCheckService,
    private readonly logger: typeof logger
  ) {}

  /**
   * Creates a new background check with enhanced validation and security
   */
  @Post()
  @RateLimit({
    keyPrefix: 'create_check',
    points: API_RATE_LIMITS.DEFAULT,
    duration: 3600
  })
  @ApiOperation({ summary: 'Create new background check' })
  @ApiSecurity('bearer')
  @ApiResponse({ status: 201, description: 'Background check created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async createBackgroundCheck(
    @Body() createDto: CreateBackgroundCheckDto
  ): Promise<BackgroundCheck> {
    try {
      // Validate input data
      const validatedData = await validateCreateBackgroundCheckDto(createDto);

      // Create background check
      const check = await this.backgroundCheckService.createBackgroundCheck(validatedData);

      this.logger.info('Background check created', {
        checkId: check.id,
        type: check.type,
        candidateId: check.candidateId
      });

      return check;
    } catch (error) {
      this.logger.error('Error creating background check', { error });
      throw error;
    }
  }

  /**
   * Retrieves background check details with security validation
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get background check details' })
  @ApiSecurity('bearer')
  @ApiResponse({ status: 200, description: 'Background check details retrieved' })
  @ApiResponse({ status: 404, description: 'Background check not found' })
  async getBackgroundCheck(@Param('id') id: string): Promise<BackgroundCheck> {
    try {
      const check = await this.backgroundCheckService.getBackgroundCheck(id);
      
      if (!check) {
        throw new NotFoundError(`Background check not found: ${id}`);
      }

      return check;
    } catch (error) {
      this.logger.error('Error retrieving background check', { error, checkId: id });
      throw error;
    }
  }

  /**
   * Updates background check status with validation
   */
  @Put(':id/status')
  @ApiOperation({ summary: 'Update background check status' })
  @ApiSecurity('bearer')
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status' })
  async updateBackgroundCheckStatus(
    @Param('id') id: string,
    @Body('status') status: BackgroundCheckStatus
  ): Promise<BackgroundCheck> {
    try {
      const check = await this.backgroundCheckService.updateBackgroundCheck(id, { status });

      this.logger.info('Background check status updated', {
        checkId: id,
        status,
        updatedAt: new Date()
      });

      return check;
    } catch (error) {
      this.logger.error('Error updating background check status', { 
        error, 
        checkId: id,
        status 
      });
      throw error;
    }
  }

  /**
   * Processes document verification for a background check
   */
  @Post(':id/documents')
  @RateLimit({
    keyPrefix: 'process_documents',
    points: API_RATE_LIMITS.DOCUMENT_UPLOAD,
    duration: 3600
  })
  @ApiOperation({ summary: 'Process background check documents' })
  @ApiSecurity('bearer')
  @ApiResponse({ status: 200, description: 'Documents processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid document data' })
  async processDocuments(
    @Param('id') id: string,
    @Body() documents: Array<{ id: string; type: string; url: string }>
  ): Promise<BackgroundCheck> {
    try {
      // Validate document data
      if (!Array.isArray(documents) || documents.length === 0) {
        throw new ValidationError('Invalid document data', [{
          field: 'documents',
          message: 'At least one document is required'
        }]);
      }

      const results = await this.backgroundCheckService.processDocuments(id, documents);

      this.logger.info('Documents processed for background check', {
        checkId: id,
        documentCount: documents.length
      });

      return results;
    } catch (error) {
      this.logger.error('Error processing documents', {
        error,
        checkId: id,
        documentCount: documents?.length
      });
      throw error;
    }
  }

  /**
   * Processes batch document verification for multiple background checks
   */
  @Post('batch/documents')
  @RateLimit({
    keyPrefix: 'batch_documents',
    points: API_RATE_LIMITS.DOCUMENT_UPLOAD,
    duration: 3600
  })
  @ApiOperation({ summary: 'Process batch document verification' })
  @ApiSecurity('bearer')
  @ApiResponse({ status: 200, description: 'Batch processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid batch data' })
  async processBatchDocuments(
    @Body() batch: Array<{
      checkId: string;
      documents: Array<{ id: string; type: string; url: string }>
    }>
  ): Promise<Array<BackgroundCheck>> {
    try {
      // Validate batch data
      if (!Array.isArray(batch) || batch.length === 0) {
        throw new ValidationError('Invalid batch data', [{
          field: 'batch',
          message: 'At least one batch item is required'
        }]);
      }

      const results = await this.backgroundCheckService.processBatchDocuments(batch);

      this.logger.info('Batch document processing completed', {
        batchSize: batch.length,
        processedAt: new Date()
      });

      return results;
    } catch (error) {
      this.logger.error('Error processing document batch', {
        error,
        batchSize: batch?.length
      });
      throw error;
    }
  }
}