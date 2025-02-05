import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'; // ^0.34.0
import { renderHook } from '@testing-library/react-hooks'; // ^8.0.1
import '@testing-library/jest-dom/extend-expect'; // ^5.16.5

import InterviewPortal from '../../../components/interviews/InterviewPortal';
import { useInterview } from '../../../hooks/useInterview';
import { Interview, InterviewStatus, InterviewType } from '../../../types/interview.types';
import { NotificationType } from '../../../types/notification.types';
import WebSocketService from '../../../services/websocket.service';

// Mock WebSocket service
vi.mock('../../../services/websocket.service', () => ({
  default: {
    getInstance: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      send: vi.fn()
    }))
  }
}));

// Mock useInterview hook
vi.mock('../../../hooks/useInterview', () => ({
  useInterview: vi.fn()
}));

// Mock MediaStream API
const mockMediaStream = {
  getTracks: () => [{
    stop: vi.fn(),
    getSettings: () => ({
      width: 1280,
      height: 720,
      frameRate: 30
    })
  }]
};

// Mock interview data
const mockInterview: Interview = {
  id: 'test-interview-id',
  type: InterviewType.TECHNICAL,
  status: InterviewStatus.SCHEDULED,
  backgroundCheckId: 'test-check-id',
  candidateId: 'test-candidate-id',
  scheduledAt: new Date(),
  duration: 1800,
  questions: [
    {
      id: 'q1',
      text: 'Describe your experience with React',
      type: 'TECHNICAL',
      category: 'FRONTEND',
      expectedDuration: 180,
      difficultyLevel: 3,
      keywords: ['React', 'JavaScript', 'Frontend'],
      scoringCriteria: { technical: 0.6, communication: 0.4 }
    }
  ],
  responses: [],
  analysis: {
    overallScore: 0,
    technicalScore: 0,
    communicationScore: 0,
    confidenceScore: 0,
    summary: '',
    strengths: [],
    weaknesses: [],
    sentimentTrend: [],
    keywordAnalysis: {},
    recommendedAction: ''
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('InterviewPortal', () => {
  // Setup hooks and mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock navigator.mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockMediaStream)
      },
      writable: true
    });

    // Mock AudioContext
    global.AudioContext = vi.fn().mockImplementation(() => ({
      createAnalyser: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequencyBinCount: 1024,
        getByteFrequencyData: vi.fn()
      }),
      createMediaStreamSource: vi.fn().mockReturnValue({
        connect: vi.fn()
      })
    }));

    // Setup useInterview mock implementation
    (useInterview as jest.Mock).mockReturnValue({
      interview: mockInterview,
      loading: { isInitializing: false },
      error: null,
      updateInterview: vi.fn().mockResolvedValue(mockInterview)
    });
  });

  // Cleanup after each test
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Initialization', () => {
    it('should render loading state initially', () => {
      (useInterview as jest.Mock).mockReturnValueOnce({
        interview: null,
        loading: { isInitializing: true },
        error: null
      });

      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      expect(screen.getByText('Initializing interview session...')).toBeInTheDocument();
    });

    it('should initialize video stream successfully', async () => {
      const onComplete = vi.fn();
      const onError = vi.fn();

      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={onComplete}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('meter', { name: /audio level/i })).toBeInTheDocument();
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it('should handle video stream initialization failure', async () => {
      const mockError = new Error('Failed to access camera');
      global.navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(mockError);

      const onError = vi.fn();

      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith({
          code: 'MEDIA_ERROR',
          message: 'Failed to initialize media stream',
          details: mockError.message
        });
      });
    });
  });

  describe('Interview Flow', () => {
    it('should display current question and timer', async () => {
      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Question 1 of 1')).toBeInTheDocument();
        expect(screen.getByText('Describe your experience with React')).toBeInTheDocument();
        expect(screen.getByText(/3:00/)).toBeInTheDocument();
      });
    });

    it('should handle next question transition', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();

      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={onComplete}
          onError={vi.fn()}
        />
      );

      const nextButton = await screen.findByText('Next Question');
      await user.click(nextButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('should monitor audio levels', async () => {
      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      const audioMeter = await screen.findByRole('meter', { name: /audio level/i });
      expect(audioMeter).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection failures', async () => {
      const wsInstance = WebSocketService.getInstance();
      (wsInstance.connect as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();
      });
    });

    it('should handle interview update failures', async () => {
      const user = userEvent.setup();
      const mockError = new Error('Update failed');
      const onError = vi.fn();

      (useInterview as jest.Mock).mockReturnValue({
        interview: mockInterview,
        loading: { isInitializing: false },
        error: null,
        updateInterview: vi.fn().mockRejectedValue(mockError)
      });

      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={onError}
        />
      );

      const nextButton = await screen.findByText('Next Question');
      await user.click(nextButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith({
          code: 'SERVER_ERROR',
          message: 'Failed to complete interview',
          details: mockError
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA requirements', async () => {
      const { container } = render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
          accessibility={{
            enableKeyboardNavigation: true,
            announceQuestions: true,
            highContrastMode: true
          }}
        />
      );

      expect(container).toHaveAttribute('role', 'main');
      expect(screen.getByRole('meter')).toHaveAttribute('aria-label', 'Audio level');
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      const nextButton = await screen.findByText('Next Question');
      await user.tab();
      expect(nextButton).toHaveFocus();
    });
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket status updates', async () => {
      const wsInstance = WebSocketService.getInstance();
      
      render(
        <InterviewPortal
          interviewId="test-interview-id"
          onComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(wsInstance.subscribe).toHaveBeenCalledWith(
          NotificationType.INTERVIEW_READY,
          expect.any(Function)
        );
      });
    });
  });
});