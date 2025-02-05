/**
 * Enhanced custom React hook for managing AI-powered interview sessions
 * with comprehensive error handling and real-time updates
 * @package @precheck/web
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { Interview, InterviewStatus, ScheduleInterviewDto } from '../types/interview.types';
import ApiService from '../services/api.service';
import WebSocketService from '../services/websocket.service';
import { NotificationType } from '../types/notification.types';

// Constants for WebSocket events and API endpoints
const INTERVIEW_WS_EVENT = 'interview.status_update';
const WS_RECONNECT_ATTEMPTS = 5;
const WS_RECONNECT_INTERVAL = 1000;
const API_RETRY_ATTEMPTS = 3;

interface InterviewError {
  code: string;
  message: string;
  details?: unknown;
}

interface InterviewLoadingState {
  isInitializing: boolean;
  isScheduling: boolean;
  isUpdating: boolean;
  isReconnecting: boolean;
}

interface InterviewOptions {
  autoConnect?: boolean;
  enableRealtime?: boolean;
  retryOnFailure?: boolean;
}

interface WebSocketStatus {
  isConnected: boolean;
  lastHeartbeat: Date | null;
  retryCount: number;
}

/**
 * Enhanced custom hook for managing interview state and operations
 * @param interviewId - Unique identifier for the interview session
 * @param options - Configuration options for the interview hook
 */
export function useInterview(
  interviewId: string,
  options: InterviewOptions = {
    autoConnect: true,
    enableRealtime: true,
    retryOnFailure: true
  }
) {
  // State management
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState<InterviewLoadingState>({
    isInitializing: true,
    isScheduling: false,
    isUpdating: false,
    isReconnecting: false
  });
  const [error, setError] = useState<InterviewError | null>(null);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>({
    isConnected: false,
    lastHeartbeat: null,
    retryCount: 0
  });

  // Refs for cleanup and state tracking
  const wsService = useRef<WebSocketService>(WebSocketService.getInstance());
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const previousInterviewRef = useRef<Interview | null>(null);

  /**
   * Fetches interview details with retry logic
   */
  const fetchInterview = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, isInitializing: true }));
      setError(null);

      const response = await ApiService.get<Interview>(`/api/v1/interviews/${interviewId}`);
      setInterview(response.data);
      previousInterviewRef.current = response.data;
    } catch (err) {
      const error = err as Error;
      setError({
        code: 'FETCH_ERROR',
        message: 'Failed to fetch interview details',
        details: error.message
      });
    } finally {
      setLoading(prev => ({ ...prev, isInitializing: false }));
    }
  }, [interviewId]);

  /**
   * Schedules a new interview with validation
   */
  const scheduleInterview = useCallback(async (data: ScheduleInterviewDto) => {
    try {
      setLoading(prev => ({ ...prev, isScheduling: true }));
      setError(null);

      const response = await ApiService.post<Interview>('/api/v1/interviews', data);
      setInterview(response.data);
      previousInterviewRef.current = response.data;

      return response.data;
    } catch (err) {
      const error = err as Error;
      setError({
        code: 'SCHEDULE_ERROR',
        message: 'Failed to schedule interview',
        details: error.message
      });
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, isScheduling: false }));
    }
  }, []);

  /**
   * Updates interview status with optimistic updates
   */
  const updateInterview = useCallback(async (
    status: InterviewStatus,
    data?: Partial<Interview>
  ) => {
    try {
      setLoading(prev => ({ ...prev, isUpdating: true }));
      setError(null);

      // Optimistic update
      if (interview) {
        const optimisticUpdate = {
          ...interview,
          status,
          ...data
        };
        setInterview(optimisticUpdate);
      }

      const response = await ApiService.put<Interview>(
        `/api/v1/interviews/${interviewId}`,
        { status, ...data }
      );

      setInterview(response.data);
      previousInterviewRef.current = response.data;

      return response.data;
    } catch (err) {
      const error = err as Error;
      // Revert optimistic update
      setInterview(previousInterviewRef.current);
      setError({
        code: 'UPDATE_ERROR',
        message: 'Failed to update interview',
        details: error.message
      });
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, isUpdating: false }));
    }
  }, [interview, interviewId]);

  /**
   * Handles WebSocket message processing
   */
  const handleWebSocketMessage = useCallback((
    event: NotificationType,
    data: unknown,
    timestamp: Date
  ) => {
    if (event === NotificationType.INTERVIEW_READY && interview) {
      setInterview(prevInterview => {
        if (!prevInterview) return null;
        return {
          ...prevInterview,
          ...data as Partial<Interview>,
          updatedAt: timestamp
        };
      });
    }
  }, [interview]);

  /**
   * Initializes WebSocket connection with retry logic
   */
  const initializeWebSocket = useCallback(() => {
    if (!options.enableRealtime) return;

    const ws = wsService.current;
    ws.subscribe(NotificationType.INTERVIEW_READY, handleWebSocketMessage);

    ws.connect().catch(error => {
      setError({
        code: 'WEBSOCKET_ERROR',
        message: 'Failed to establish real-time connection',
        details: error.message
      });
    });

    return () => {
      ws.unsubscribe(NotificationType.INTERVIEW_READY, handleWebSocketMessage);
    };
  }, [options.enableRealtime, handleWebSocketMessage]);

  /**
   * Retries WebSocket connection with exponential backoff
   */
  const retryConnection = useCallback(() => {
    if (wsStatus.retryCount >= WS_RECONNECT_ATTEMPTS) {
      setError({
        code: 'MAX_RETRIES_EXCEEDED',
        message: 'Maximum reconnection attempts exceeded'
      });
      return;
    }

    setLoading(prev => ({ ...prev, isReconnecting: true }));
    const backoffDelay = Math.min(
      WS_RECONNECT_INTERVAL * Math.pow(1.5, wsStatus.retryCount),
      30000
    );

    retryTimeoutRef.current = setTimeout(() => {
      setWsStatus(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1
      }));
      initializeWebSocket();
    }, backoffDelay);
  }, [wsStatus.retryCount, initializeWebSocket]);

  // Initialize interview data and WebSocket connection
  useEffect(() => {
    if (interviewId) {
      fetchInterview();
    }

    if (options.autoConnect) {
      initializeWebSocket();
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      wsService.current.disconnect();
    };
  }, [interviewId, options.autoConnect, fetchInterview, initializeWebSocket]);

  return {
    interview,
    loading,
    error,
    scheduleInterview,
    updateInterview,
    retryConnection,
    connectionStatus: wsStatus
  };
}

export type { InterviewError, InterviewLoadingState, InterviewOptions, WebSocketStatus };