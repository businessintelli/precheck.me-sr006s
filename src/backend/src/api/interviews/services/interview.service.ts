import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { Cache } from '@nestjs/cache-manager';
import { NotificationService } from '@nestjs/notifications';

import { 
  Interview, 
  InterviewType, 
  InterviewStatus, 
  InterviewQuestion,
  InterviewResponse,
  InterviewAnalysis,
  ScheduleInterviewDto
} from '../../../types/interview.types';
import { InterviewModel } from '../../../database/models/interview.model';
import { Logger } from '../../../utils/logger';
import { INTERVIEW_CONFIG } from '../../../utils/constants';

@Injectable()
export class InterviewService {
  constructor(
    private readonly interviewModel: InterviewModel,
    private readonly logger: Logger,
    private readonly notificationService: NotificationService,
    private readonly cacheManager: Cache
  ) {}

  /**
   * Schedules a new AI-powered interview with comprehensive validation
   * @param data Interview scheduling data
   * @returns Created interview record
   */
  public async scheduleInterview(data: ScheduleInterviewDto): Promise<Interview> {
    this.logger.info('Initiating interview scheduling', {
      type: data.type,
      backgroundCheckId: data.backgroundCheckId
    });

    try {
      // Validate interview type
      if (!Object.values(InterviewType).includes(data.type)) {
        throw new BadRequestException('Invalid interview type');
      }

      // Validate duration against configuration
      const duration = data.duration || INTERVIEW_CONFIG.DEFAULT_DURATION;
      if (duration < 0 || duration > INTERVIEW_CONFIG.DEFAULT_DURATION * 2) {
        throw new BadRequestException('Invalid interview duration');
      }

      // Create interview record with AI-generated questions
      const interview = await this.interviewModel.schedule({
        ...data,
        duration,
        status: InterviewStatus.SCHEDULED
      });

      // Cache interview details
      await this.cacheManager.set(
        `interview:${interview.id}`,
        interview,
        INTERVIEW_CONFIG.CACHE_TTL
      );

      // Send real-time notification
      await this.notificationService.send({
        type: 'INTERVIEW_SCHEDULED',
        recipients: [data.candidateId],
        data: {
          interviewId: interview.id,
          scheduledAt: data.scheduledAt,
          type: data.type
        }
      });

      this.logger.info('Interview scheduled successfully', {
        interviewId: interview.id
      });

      return interview;

    } catch (error) {
      this.logger.error('Failed to schedule interview', error);
      throw error;
    }
  }

  /**
   * Processes and analyzes interview responses with AI integration
   * @param interviewId Interview identifier
   * @param response Candidate's interview response
   * @returns Updated interview with analysis
   */
  public async submitResponse(
    interviewId: string,
    response: InterviewResponse
  ): Promise<Interview> {
    this.logger.info('Processing interview response', { interviewId });

    try {
      // Retrieve interview with validation
      const interview = await this.interviewModel.findById(interviewId);
      if (!interview) {
        throw new BadRequestException('Interview not found');
      }

      // Validate interview status
      if (interview.status !== InterviewStatus.IN_PROGRESS) {
        throw new BadRequestException('Interview is not in progress');
      }

      // Validate response against question
      const question = interview.questions.find(q => q.id === response.questionId);
      if (!question) {
        throw new BadRequestException('Invalid question ID');
      }

      // Process response through AI analysis
      const analysis = await this.interviewModel.analyzeResponse(
        interviewId,
        response
      );

      // Update interview status based on progress
      const updatedStatus = this.determineInterviewStatus(
        interview.questions.length,
        interview.responses.length + 1
      );

      // Update interview record
      const updatedInterview = await this.interviewModel.update(interviewId, {
        status: updatedStatus,
        responses: [...interview.responses, response],
        analysis: {
          ...interview.analysis,
          ...analysis
        }
      });

      // Invalidate cache
      await this.cacheManager.del(`interview:${interviewId}`);

      // Send real-time update
      await this.notificationService.send({
        type: 'INTERVIEW_RESPONSE_PROCESSED',
        recipients: [interview.candidateId],
        data: {
          interviewId,
          status: updatedStatus,
          progress: {
            completed: interview.responses.length + 1,
            total: interview.questions.length
          }
        }
      });

      this.logger.info('Interview response processed', {
        interviewId,
        status: updatedStatus
      });

      return updatedInterview;

    } catch (error) {
      this.logger.error('Failed to process interview response', error);
      throw error;
    }
  }

  /**
   * Retrieves interview details with caching
   * @param id Interview identifier
   * @returns Interview record
   */
  public async getInterview(id: string): Promise<Interview> {
    // Check cache first
    const cached = await this.cacheManager.get<Interview>(`interview:${id}`);
    if (cached) {
      return cached;
    }

    const interview = await this.interviewModel.findById(id);
    if (!interview) {
      throw new BadRequestException('Interview not found');
    }

    // Cache interview data
    await this.cacheManager.set(
      `interview:${id}`,
      interview,
      INTERVIEW_CONFIG.CACHE_TTL
    );

    return interview;
  }

  /**
   * Determines interview status based on response progress
   * @param totalQuestions Total number of questions
   * @param answeredQuestions Number of answered questions
   * @returns Updated interview status
   */
  private determineInterviewStatus(
    totalQuestions: number,
    answeredQuestions: number
  ): InterviewStatus {
    if (answeredQuestions === 0) {
      return InterviewStatus.SCHEDULED;
    }
    if (answeredQuestions === totalQuestions) {
      return InterviewStatus.COMPLETED;
    }
    return InterviewStatus.IN_PROGRESS;
  }
}