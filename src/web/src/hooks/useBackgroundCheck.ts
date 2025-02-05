/**
 * Enhanced React hook for managing background check operations with real-time updates
 * @package @precheck/web
 * @version 1.0.0
 */

import { useState, useCallback } from 'react'; // ^18.0.0
import { useQuery, useMutation } from '@tanstack/react-query'; // ^5.0.0
import toast from 'react-hot-toast'; // ^2.0.0
import { ApiService } from '../services/api.service';
import { API_ENDPOINTS } from '../lib/constants';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  BackgroundCheck, 
  BackgroundCheckStatus, 
  CreateBackgroundCheckDtoType 
} from '../types/background-check.types';
import { NotificationType } from '../types/notification.types';

/**
 * Interface for background check error with enhanced details
 */
interface BackgroundCheckError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Enhanced hook for managing background check operations
 * @param backgroundCheckId - Optional ID of existing background check
 */
export const useBackgroundCheck = (backgroundCheckId?: string) => {
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const { subscribe, unsubscribe, isConnected } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  /**
   * Fetch background check details with enhanced error handling
   */
  const fetchBackgroundCheck = useCallback(async (id: string): Promise<BackgroundCheck> => {
    try {
      const response = await ApiService.get<BackgroundCheck>(
        `${API_ENDPOINTS.BACKGROUND_CHECKS.BASE}/${id}`
      );
      return response;
    } catch (error) {
      const apiError = error as BackgroundCheckError;
      toast.error(`Failed to fetch background check: ${apiError.message}`);
      throw apiError;
    }
  }, []);

  /**
   * Query hook for background check data with real-time updates
   */
  const {
    data: backgroundCheck,
    isLoading,
    error,
    refetch
  } = useQuery<BackgroundCheck, BackgroundCheckError>({
    queryKey: ['backgroundCheck', backgroundCheckId],
    queryFn: () => backgroundCheckId ? fetchBackgroundCheck(backgroundCheckId) : Promise.reject('No ID provided'),
    enabled: !!backgroundCheckId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 3
  });

  /**
   * Mutation hook for creating new background checks
   */
  const createMutation = useMutation<
    BackgroundCheck,
    BackgroundCheckError,
    CreateBackgroundCheckDtoType
  >({
    mutationFn: async (data: CreateBackgroundCheckDtoType) => {
      const response = await ApiService.post<BackgroundCheck>(
        API_ENDPOINTS.BACKGROUND_CHECKS.CREATE,
        data
      );
      toast.success('Background check initiated successfully');
      return response;
    },
    onError: (error) => {
      toast.error(`Failed to create background check: ${error.message}`);
    }
  });

  /**
   * Mutation hook for updating background check status
   */
  const updateMutation = useMutation<
    BackgroundCheck,
    BackgroundCheckError,
    { id: string; status: BackgroundCheckStatus }
  >({
    mutationFn: async ({ id, status }) => {
      const response = await ApiService.put<BackgroundCheck>(
        `${API_ENDPOINTS.BACKGROUND_CHECKS.UPDATE.replace(':id', id)}`,
        { status }
      );
      toast.success('Background check updated successfully');
      return response;
    },
    onError: (error) => {
      toast.error(`Failed to update background check: ${error.message}`);
    }
  });

  /**
   * Handle real-time status updates via WebSocket
   */
  const handleStatusUpdate = useCallback((data: any) => {
    if (data.checkId === backgroundCheckId) {
      refetch();
      toast.success(`Background check status updated to: ${data.status}`);
    }
  }, [backgroundCheckId, refetch]);

  /**
   * Subscribe to real-time updates when enabled
   */
  useState(() => {
    if (isRealTimeEnabled && backgroundCheckId) {
      subscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
      return () => {
        unsubscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
      };
    }
  }, [isRealTimeEnabled, backgroundCheckId, subscribe, unsubscribe, handleStatusUpdate]);

  /**
   * Create new background check with optimistic updates
   */
  const createBackgroundCheck = async (data: CreateBackgroundCheckDtoType) => {
    try {
      const result = await createMutation.mutateAsync(data);
      return result;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Update background check status with optimistic updates
   */
  const updateBackgroundCheck = async (id: string, status: BackgroundCheckStatus) => {
    try {
      const result = await updateMutation.mutateAsync({ id, status });
      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    backgroundCheck,
    isLoading,
    error,
    createBackgroundCheck,
    updateBackgroundCheck,
    isRealTimeEnabled,
    setIsRealTimeEnabled,
    isWebSocketConnected: isConnected,
    refetch
  };
};