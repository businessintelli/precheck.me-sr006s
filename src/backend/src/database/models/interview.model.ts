import { PrismaClient } from '@prisma/client'; // @version ^5.4.2
import { OpenAI } from 'openai'; // @version ^4.0.0
import Cache from 'node-cache'; // @version ^5.1.2
import { 
  Interview, 
  InterviewType, 
  InterviewStatus, 
  InterviewQuestion,
  InterviewResponse,
  InterviewAnalysis,
  ScheduleInterviewDto
} from '../../types/interview.types';
import { Logger } from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { INTERVIEW_CONFIG } from '../../utils/constants';

/**
 * Enhanced model class for managing AI-powered interview operations
 */
export class InterviewModel {
  private prisma: PrismaClient;
  private logger: Logger;
  private cache: Cache;
  private openai: OpenAI;

  constructor(
    logger: Logger,
    cache: Cache,
    openai: OpenAI
  ) {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
      errorFormat: 'minimal'
    });
    this.logger = logger;
    this.cache = cache;
    this.openai = openai;
  }

  /**
   * Schedules a new AI-powered interview session
   */
  public async schedule(data: ScheduleInterviewDto): Promise<Interview> {
    this.logger.info('Scheduling new interview', { type: data.type });

    try {
      // Validate interview type and duration
      if (!Object.values(InterviewType).includes(data.type)) {
        throw new ValidationError('Invalid interview type', [{
          field: 'type',
          message: 'Invalid interview type selected'
        }]);
      }

      // Generate AI questions based on interview type
      const questions = await this.generateInterviewQuestions(
        data.type,
        INTERVIEW_CONFIG.MAX_QUESTIONS[data.type]
      );

      // Create interview record in transaction
      const interview = await this.prisma.$transaction(async (tx) => {
        // Verify background check exists
        const backgroundCheck = await tx.backgroundCheck.findUnique({
          where: { id: data.backgroundCheckId }
        });

        if (!backgroundCheck) {
          throw new NotFoundError('Background check not found');
        }

        // Create interview record
        const newInterview = await tx.interview.create({
          data: {
            type: data.type,
            status: InterviewStatus.SCHEDULED,
            backgroundCheckId: data.backgroundCheckId,
            candidateId: data.candidateId,
            organizationId: data.organizationId,
            scheduledAt: data.scheduledAt,
            duration: data.duration || INTERVIEW_CONFIG.DEFAULT_DURATION,
            questions,
            responses: [],
            analysis: null,
            metadata: {}
          }
        });

        // Update background check status
        await tx.backgroundCheck.update({
          where: { id: data.backgroundCheckId },
          data: { status: 'INTERVIEW_SCHEDULED' }
        });

        return newInterview;
      });

      // Cache interview data
      this.cache.set(`interview:${interview.id}`, interview, 3600);

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
   * Analyzes interview responses using AI
   */
  public async analyzeResponse(
    interviewId: string,
    response: InterviewResponse
  ): Promise<InterviewAnalysis> {
    this.logger.info('Analyzing interview response', { interviewId });

    try {
      // Retrieve interview with questions
      const interview = await this.findById(interviewId);
      if (!interview) {
        throw new NotFoundError('Interview not found');
      }

      // Validate response matches question
      const question = interview.questions.find(q => q.id === response.questionId);
      if (!question) {
        throw new ValidationError('Invalid question ID', [{
          field: 'questionId',
          message: 'Question not found in interview'
        }]);
      }

      // Process response through OpenAI
      const analysis = await this.processAIAnalysis(
        question,
        response,
        interview.type
      );

      // Update interview record
      await this.prisma.interview.update({
        where: { id: interviewId },
        data: {
          responses: [...interview.responses, response],
          analysis,
          status: this.determineInterviewStatus(interview, response)
        }
      });

      // Invalidate cache
      this.cache.del(`interview:${interviewId}`);

      this.logger.info('Response analysis completed', { 
        interviewId,
        questionId: response.questionId 
      });

      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze response', error);
      throw error;
    }
  }

  /**
   * Retrieves interview by ID with caching
   */
  public async findById(id: string): Promise<Interview | null> {
    // Check cache first
    const cached = this.cache.get<Interview>(`interview:${id}`);
    if (cached) {
      return cached;
    }

    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id },
        include: {
          backgroundCheck: true
        }
      });

      if (interview) {
        this.cache.set(`interview:${id}`, interview, 3600);
      }

      return interview;

    } catch (error) {
      this.logger.error('Failed to retrieve interview', error);
      throw error;
    }
  }

  /**
   * Generates AI-powered interview questions
   */
  private async generateInterviewQuestions(
    type: InterviewType,
    count: number
  ): Promise<InterviewQuestion[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        ...INTERVIEW_CONFIG.AI_MODEL_CONFIG,
        messages: [{
          role: 'system',
          content: `Generate ${count} interview questions for a ${type} interview. 
                   Include scoring criteria and expected keywords.`
        }]
      });

      const questions: InterviewQuestion[] = JSON.parse(
        completion.choices[0].message.content || '[]'
      );

      return questions.map((q, index) => ({
        ...q,
        id: `q-${index + 1}`,
        type: type.toLowerCase(),
        expectedDuration: INTERVIEW_CONFIG.RESPONSE_TIME_LIMIT
      }));

    } catch (error) {
      this.logger.error('Failed to generate interview questions', error);
      throw error;
    }
  }

  /**
   * Processes interview response through AI analysis
   */
  private async processAIAnalysis(
    question: InterviewQuestion,
    response: InterviewResponse,
    type: InterviewType
  ): Promise<InterviewAnalysis> {
    try {
      const completion = await this.openai.chat.completions.create({
        ...INTERVIEW_CONFIG.AI_MODEL_CONFIG,
        messages: [{
          role: 'system',
          content: `Analyze the following ${type} interview response. 
                   Question: ${question.text}
                   Response: ${response.response}
                   Expected keywords: ${question.keywords.join(', ')}`
        }]
      });

      const analysis: InterviewAnalysis = JSON.parse(
        completion.choices[0].message.content || '{}'
      );

      return {
        ...analysis,
        aiConfidence: completion.choices[0].finish_reason === 'stop' ? 1 : 0.8
      };

    } catch (error) {
      this.logger.error('Failed to process AI analysis', error);
      throw error;
    }
  }

  /**
   * Determines interview status based on progress
   */
  private determineInterviewStatus(
    interview: Interview,
    latestResponse: InterviewResponse
  ): InterviewStatus {
    const responseCount = interview.responses.length + 1;
    const totalQuestions = interview.questions.length;

    if (responseCount === totalQuestions) {
      return InterviewStatus.COMPLETED;
    } else if (responseCount > 0) {
      return InterviewStatus.IN_PROGRESS;
    }
    return interview.status;
  }
}