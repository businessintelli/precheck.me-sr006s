import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from '@nestjs/cache-manager';
import { NotificationService } from '@nestjs/common';
import { InterviewService } from '../services/interview.service';
import { InterviewModel } from '../../../database/models/interview.model';
import { 
  Interview,
  InterviewType,
  InterviewStatus,
  InterviewQuestion,
  InterviewResponse,
  InterviewAnalysis,
  ScheduleInterviewDto
} from '../../../types/interview.types';
import { INTERVIEW_CONFIG } from '../../../utils/constants';
import { NotFoundError, ValidationError } from '../../../utils/errors';
import { Logger } from '../../../utils/logger';

describe('InterviewService', () => {
  let interviewService: InterviewService;
  let mockInterviewModel: jest.Mocked<InterviewModel>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockCacheManager: jest.Mocked<Cache>;
  let mockLogger: jest.Mocked<Logger>;

  const mockInterview: Interview = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    type: InterviewType.TECHNICAL,
    status: InterviewStatus.SCHEDULED,
    backgroundCheckId: '123e4567-e89b-12d3-a456-426614174001',
    candidateId: '123e4567-e89b-12d3-a456-426614174002',
    organizationId: '123e4567-e89b-12d3-a456-426614174003',
    scheduledAt: new Date(),
    duration: INTERVIEW_CONFIG.DEFAULT_DURATION,
    questions: [],
    responses: [],
    analysis: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(async () => {
    mockInterviewModel = {
      schedule: jest.fn(),
      findById: jest.fn(),
      analyzeResponse: jest.fn(),
      update: jest.fn()
    } as any;

    mockNotificationService = {
      send: jest.fn()
    } as any;

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        {
          provide: InterviewModel,
          useValue: mockInterviewModel
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService
        },
        {
          provide: Cache,
          useValue: mockCacheManager
        },
        {
          provide: Logger,
          useValue: mockLogger
        }
      ]
    }).compile();

    interviewService = module.get<InterviewService>(InterviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleInterview', () => {
    const scheduleDto: ScheduleInterviewDto = {
      type: InterviewType.TECHNICAL,
      backgroundCheckId: '123e4567-e89b-12d3-a456-426614174001',
      candidateId: '123e4567-e89b-12d3-a456-426614174002',
      organizationId: '123e4567-e89b-12d3-a456-426614174003',
      scheduledAt: new Date(),
      duration: INTERVIEW_CONFIG.DEFAULT_DURATION
    };

    it('should successfully schedule an interview with AI-generated questions', async () => {
      mockInterviewModel.schedule.mockResolvedValue(mockInterview);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockNotificationService.send.mockResolvedValue(undefined);

      const result = await interviewService.scheduleInterview(scheduleDto);

      expect(result).toEqual(mockInterview);
      expect(mockInterviewModel.schedule).toHaveBeenCalledWith({
        ...scheduleDto,
        status: InterviewStatus.SCHEDULED
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `interview:${mockInterview.id}`,
        mockInterview,
        INTERVIEW_CONFIG.CACHE_TTL
      );
      expect(mockNotificationService.send).toHaveBeenCalledWith({
        type: 'INTERVIEW_SCHEDULED',
        recipients: [scheduleDto.candidateId],
        data: expect.any(Object)
      });
    });

    it('should throw ValidationError for invalid interview type', async () => {
      const invalidDto = { ...scheduleDto, type: 'INVALID_TYPE' as InterviewType };
      
      await expect(interviewService.scheduleInterview(invalidDto))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid duration', async () => {
      const invalidDto = { ...scheduleDto, duration: -1 };
      
      await expect(interviewService.scheduleInterview(invalidDto))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getInterview', () => {
    const interviewId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return cached interview if available', async () => {
      mockCacheManager.get.mockResolvedValue(mockInterview);

      const result = await interviewService.getInterview(interviewId);

      expect(result).toEqual(mockInterview);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`interview:${interviewId}`);
      expect(mockInterviewModel.findById).not.toHaveBeenCalled();
    });

    it('should fetch and cache interview if not in cache', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockInterviewModel.findById.mockResolvedValue(mockInterview);

      const result = await interviewService.getInterview(interviewId);

      expect(result).toEqual(mockInterview);
      expect(mockInterviewModel.findById).toHaveBeenCalledWith(interviewId);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `interview:${interviewId}`,
        mockInterview,
        INTERVIEW_CONFIG.CACHE_TTL
      );
    });

    it('should throw NotFoundError for non-existent interview', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockInterviewModel.findById.mockResolvedValue(null);

      await expect(interviewService.getInterview(interviewId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('submitResponse', () => {
    const interviewId = '123e4567-e89b-12d3-a456-426614174000';
    const mockResponse: InterviewResponse = {
      questionId: '123e4567-e89b-12d3-a456-426614174004',
      response: 'Test response',
      audioUrl: 'https://example.com/audio.webm',
      duration: 120,
      sentiment: 0.8,
      confidence: 0.9,
      clarity: 0.85,
      keywords: ['test', 'response'],
      transcription: 'Test response transcription'
    };

    const mockAnalysis: InterviewAnalysis = {
      overallScore: 85,
      technicalScore: 80,
      communicationScore: 90,
      confidenceScore: 85,
      problemSolvingScore: 88,
      cultureFitScore: 92,
      summary: 'Good response',
      strengths: ['Technical knowledge'],
      weaknesses: ['Could improve explanation'],
      recommendations: ['Practice more'],
      keywordMatches: { test: 1 },
      aiConfidence: 0.95
    };

    it('should successfully process and analyze response', async () => {
      const interviewWithQuestion = {
        ...mockInterview,
        status: InterviewStatus.IN_PROGRESS,
        questions: [{
          id: mockResponse.questionId,
          text: 'Test question'
        }] as InterviewQuestion[]
      };

      mockInterviewModel.findById.mockResolvedValue(interviewWithQuestion);
      mockInterviewModel.analyzeResponse.mockResolvedValue(mockAnalysis);
      mockInterviewModel.update.mockResolvedValue({
        ...interviewWithQuestion,
        responses: [mockResponse],
        analysis: mockAnalysis
      });

      const result = await interviewService.submitResponse(interviewId, mockResponse);

      expect(result.responses).toContain(mockResponse);
      expect(result.analysis).toEqual(mockAnalysis);
      expect(mockCacheManager.del).toHaveBeenCalledWith(`interview:${interviewId}`);
      expect(mockNotificationService.send).toHaveBeenCalledWith({
        type: 'INTERVIEW_RESPONSE_PROCESSED',
        recipients: [interviewWithQuestion.candidateId],
        data: expect.any(Object)
      });
    });

    it('should throw ValidationError for invalid question ID', async () => {
      const interviewWithoutQuestion = {
        ...mockInterview,
        status: InterviewStatus.IN_PROGRESS,
        questions: []
      };

      mockInterviewModel.findById.mockResolvedValue(interviewWithoutQuestion);

      await expect(interviewService.submitResponse(interviewId, mockResponse))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for incorrect interview status', async () => {
      const completedInterview = {
        ...mockInterview,
        status: InterviewStatus.COMPLETED
      };

      mockInterviewModel.findById.mockResolvedValue(completedInterview);

      await expect(interviewService.submitResponse(interviewId, mockResponse))
        .rejects
        .toThrow(ValidationError);
    });
  });
});