import { describe, beforeAll, beforeEach, it, expect, jest } from '@jest/globals'; // @version ^29.0.0
import { Server } from 'mock-socket'; // @version ^9.2.1
import { InterviewController } from '../controllers/interview.controller';
import { InterviewService } from '../services/interview.service';
import { 
  Interview, 
  InterviewType, 
  InterviewStatus, 
  InterviewResponse 
} from '../../../types/interview.types';
import { SecurityContext } from '../../../middleware/security-context';
import { ValidationError, NotFoundError } from '../../../utils/errors';
import { INTERVIEW_CONFIG } from '../../../utils/constants';

// Mock dependencies
jest.mock('../services/interview.service');
jest.mock('../../../middleware/security-context');
jest.mock('../../../utils/websocket');

describe('InterviewController', () => {
  let controller: InterviewController;
  let mockInterviewService: jest.Mocked<InterviewService>;
  let mockWebSocket: Server;
  let mockSecurityContext: jest.Mocked<SecurityContext>;

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
    analysis: {
      overallScore: 0,
      technicalScore: 0,
      communicationScore: 0,
      confidenceScore: 0,
      problemSolvingScore: 0,
      cultureFitScore: 0,
      summary: '',
      strengths: [],
      weaknesses: [],
      recommendations: [],
      keywordMatches: {},
      aiConfidence: 0
    },
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeAll(() => {
    // Setup WebSocket mock server
    mockWebSocket = new Server('ws://localhost:8080');
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocked interview service
    mockInterviewService = {
      scheduleInterview: jest.fn(),
      getInterviewById: jest.fn(),
      submitResponse: jest.fn(),
      completeInterview: jest.fn(),
      processAIResponse: jest.fn()
    } as unknown as jest.Mocked<InterviewService>;

    // Initialize controller with mocked dependencies
    controller = new InterviewController(mockInterviewService);
  });

  describe('scheduleInterview', () => {
    const mockScheduleDto = {
      type: InterviewType.TECHNICAL,
      backgroundCheckId: '123e4567-e89b-12d3-a456-426614174001',
      candidateId: '123e4567-e89b-12d3-a456-426614174002',
      organizationId: '123e4567-e89b-12d3-a456-426614174003',
      scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
      duration: 45 * 60 // 45 minutes
    };

    it('should successfully schedule an interview with valid data', async () => {
      mockInterviewService.scheduleInterview.mockResolvedValue(mockInterview);

      const result = await controller.scheduleInterview(mockScheduleDto);

      expect(result).toEqual(mockInterview);
      expect(mockInterviewService.scheduleInterview).toHaveBeenCalledWith(mockScheduleDto);
    });

    it('should enforce tenant isolation', async () => {
      mockSecurityContext.validateTenantAccess.mockImplementation(() => {
        throw new ValidationError('Invalid tenant access', [{
          field: 'organizationId',
          message: 'Access denied to this organization'
        }]);
      });

      await expect(controller.scheduleInterview(mockScheduleDto))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle rate limiting', async () => {
      const requests = Array(INTERVIEW_CONFIG.MAX_QUESTIONS[InterviewType.TECHNICAL] + 1)
        .fill(mockScheduleDto);
      
      await Promise.all(requests.map(req => controller.scheduleInterview(req)))
        .catch(error => {
          expect(error.message).toContain('Rate limit exceeded');
        });
    });
  });

  describe('getInterview', () => {
    const interviewId = '123e4567-e89b-12d3-a456-426614174000';

    it('should retrieve interview details successfully', async () => {
      mockInterviewService.getInterviewById.mockResolvedValue(mockInterview);

      const result = await controller.getInterview(interviewId);

      expect(result).toEqual(mockInterview);
      expect(mockInterviewService.getInterviewById).toHaveBeenCalledWith(interviewId);
    });

    it('should handle non-existent interviews', async () => {
      mockInterviewService.getInterviewById.mockResolvedValue(null);

      await expect(controller.getInterview(interviewId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('submitResponse', () => {
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

    it('should process AI response analysis successfully', async () => {
      mockInterviewService.submitResponse.mockResolvedValue({
        ...mockInterview,
        responses: [mockResponse]
      });

      const result = await controller.submitResponse(mockInterview.id, mockResponse);

      expect(result.responses).toContain(mockResponse);
      expect(mockInterviewService.submitResponse).toHaveBeenCalledWith(
        mockInterview.id,
        mockResponse
      );
    });

    it('should validate response format', async () => {
      const invalidResponse = { ...mockResponse, questionId: 'invalid-id' };

      await expect(controller.submitResponse(mockInterview.id, invalidResponse))
        .rejects
        .toThrow(ValidationError);
    });

    it('should update interview status after response', async () => {
      const updatedInterview = {
        ...mockInterview,
        status: InterviewStatus.IN_PROGRESS,
        responses: [mockResponse]
      };

      mockInterviewService.submitResponse.mockResolvedValue(updatedInterview);

      const result = await controller.submitResponse(mockInterview.id, mockResponse);

      expect(result.status).toBe(InterviewStatus.IN_PROGRESS);
    });
  });

  describe('completeInterview', () => {
    it('should complete interview successfully', async () => {
      const completedInterview = {
        ...mockInterview,
        status: InterviewStatus.COMPLETED
      };

      mockInterviewService.completeInterview.mockResolvedValue(completedInterview);

      const result = await controller.completeInterview(mockInterview.id);

      expect(result.status).toBe(InterviewStatus.COMPLETED);
      expect(mockInterviewService.completeInterview).toHaveBeenCalledWith(mockInterview.id);
    });

    it('should validate interview completion requirements', async () => {
      mockInterviewService.completeInterview.mockImplementation(() => {
        throw new ValidationError('Invalid completion request', [{
          field: 'status',
          message: 'All questions must be answered before completion'
        }]);
      });

      await expect(controller.completeInterview(mockInterview.id))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('updateStatus', () => {
    it('should update interview status successfully', async () => {
      const newStatus = InterviewStatus.IN_PROGRESS;
      const updatedInterview = {
        ...mockInterview,
        status: newStatus
      };

      mockInterviewService.updateInterviewStatus.mockResolvedValue(updatedInterview);

      const result = await controller.updateStatus(mockInterview.id, newStatus);

      expect(result.status).toBe(newStatus);
      expect(mockInterviewService.updateInterviewStatus).toHaveBeenCalledWith(
        mockInterview.id,
        newStatus
      );
    });

    it('should validate status transitions', async () => {
      const invalidStatus = 'INVALID_STATUS' as InterviewStatus;

      await expect(controller.updateStatus(mockInterview.id, invalidStatus))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('Real-time Updates', () => {
    it('should emit status updates via WebSocket', async () => {
      const mockSocket = mockWebSocket.clients()[0];
      const messagePromise = new Promise(resolve => {
        mockSocket.onmessage = (event) => resolve(JSON.parse(event.data));
      });

      await controller.updateStatus(mockInterview.id, InterviewStatus.IN_PROGRESS);

      const message = await messagePromise;
      expect(message).toMatchObject({
        type: 'INTERVIEW_STATUS_UPDATE',
        interviewId: mockInterview.id,
        status: InterviewStatus.IN_PROGRESS
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response processing time', async () => {
      const startTime = Date.now();
      await controller.submitResponse(mockInterview.id, mockResponse);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(INTERVIEW_CONFIG.RESPONSE_TIME_LIMIT * 1000);
    });
  });
});