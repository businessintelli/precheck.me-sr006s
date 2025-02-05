import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Param, 
  Body, 
  UseGuards, 
  UseInterceptors 
} from '@nestjs/common'; // @version ^10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity, 
  ApiHeader 
} from '@nestjs/swagger'; // @version ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // @version ^5.0.0

import { InterviewService } from '../services/interview.service';
import { 
  Interview, 
  InterviewStatus, 
  InterviewResponse, 
  InterviewAnalysis 
} from '../../../types/interview.types';
import { validateScheduleInterviewDto, ScheduleInterviewDto } from '../dto/schedule-interview.dto';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../../auth/guards/tenant.guard';
import { LoggingInterceptor } from '../../../interceptors/logging.interceptor';
import { CacheInterceptor } from '../../../interceptors/cache.interceptor';
import { SecureLogger } from '../../../utils/logger';
import { API_RATE_LIMITS } from '../../../utils/constants';
import { ValidationError, NotFoundError } from '../../../utils/errors';

@Controller('interviews')
@ApiTags('interviews')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
@ApiSecurity('bearer')
export class InterviewController {
  private readonly logger: SecureLogger;

  constructor(
    private readonly interviewService: InterviewService
  ) {
    this.logger = new SecureLogger();
  }

  @Post()
  @RateLimit({ ttl: 60, limit: API_RATE_LIMITS.INTERVIEW })
  @ApiOperation({ summary: 'Schedule new AI-powered interview' })
  @ApiResponse({ status: 201, description: 'Interview scheduled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 403, description: 'Tenant access denied' })
  @ApiHeader({ name: 'x-tenant-id', required: true })
  async scheduleInterview(
    @Body() scheduleDto: ScheduleInterviewDto
  ): Promise<Interview> {
    this.logger.info('Scheduling new interview', { type: scheduleDto.type });

    try {
      // Validate request data
      const validatedData = validateScheduleInterviewDto(scheduleDto);

      // Schedule interview through service
      const interview = await this.interviewService.scheduleInterview(validatedData);

      this.logger.info('Interview scheduled successfully', { 
        interviewId: interview.id 
      });

      return interview;

    } catch (error) {
      this.logger.error('Failed to schedule interview', error);
      throw error;
    }
  }

  @Get(':id')
  @RateLimit({ ttl: 60, limit: API_RATE_LIMITS.INTERVIEW })
  @ApiOperation({ summary: 'Get interview details' })
  @ApiResponse({ status: 200, description: 'Interview details retrieved' })
  @ApiResponse({ status: 404, description: 'Interview not found' })
  async getInterview(@Param('id') id: string): Promise<Interview> {
    this.logger.info('Retrieving interview details', { interviewId: id });

    const interview = await this.interviewService.getInterviewById(id);
    if (!interview) {
      throw new NotFoundError('Interview not found');
    }

    return interview;
  }

  @Put(':id/responses')
  @RateLimit({ ttl: 60, limit: API_RATE_LIMITS.INTERVIEW })
  @ApiOperation({ summary: 'Submit interview response' })
  @ApiResponse({ status: 200, description: 'Response processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid response data' })
  async submitResponse(
    @Param('id') id: string,
    @Body() response: InterviewResponse
  ): Promise<Interview> {
    this.logger.info('Processing interview response', { 
      interviewId: id,
      questionId: response.questionId 
    });

    try {
      return await this.interviewService.submitResponse(id, response);
    } catch (error) {
      this.logger.error('Failed to process interview response', error);
      throw error;
    }
  }

  @Put(':id/complete')
  @RateLimit({ ttl: 60, limit: API_RATE_LIMITS.INTERVIEW })
  @ApiOperation({ summary: 'Complete interview' })
  @ApiResponse({ status: 200, description: 'Interview completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid completion request' })
  async completeInterview(
    @Param('id') id: string
  ): Promise<Interview> {
    this.logger.info('Completing interview', { interviewId: id });

    try {
      const interview = await this.interviewService.completeInterview(id);
      
      this.logger.info('Interview completed successfully', { 
        interviewId: id,
        status: InterviewStatus.COMPLETED
      });

      return interview;

    } catch (error) {
      this.logger.error('Failed to complete interview', error);
      throw error;
    }
  }

  @Put(':id/status')
  @RateLimit({ ttl: 60, limit: API_RATE_LIMITS.INTERVIEW })
  @ApiOperation({ summary: 'Update interview status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status update' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: InterviewStatus
  ): Promise<Interview> {
    this.logger.info('Updating interview status', { 
      interviewId: id,
      status 
    });

    try {
      if (!Object.values(InterviewStatus).includes(status)) {
        throw new ValidationError('Invalid interview status', [{
          field: 'status',
          message: 'Invalid status value provided'
        }]);
      }

      return await this.interviewService.updateInterviewStatus(id, status);

    } catch (error) {
      this.logger.error('Failed to update interview status', error);
      throw error;
    }
  }
}