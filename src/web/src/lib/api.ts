/**
 * Core API client implementation for Precheck.me frontend application
 * Provides typed HTTP methods and service-specific API functions with enhanced security,
 * monitoring, and error handling capabilities.
 * @package @precheck/web
 * @version 1.0.0
 */

import axiosInstance from './axios';
import { API_ENDPOINTS } from './constants';
import { AxiosResponse } from 'axios'; // ^1.6.0
import { z } from 'zod'; // ^3.22.0
import winston from 'winston'; // ^3.11.0
import { 
  BackgroundCheck, 
  CreateBackgroundCheckDto, 
  BackgroundCheckStatus 
} from '../types/background-check.types';
import { 
  Document, 
  DocumentUploadResponse, 
  DocumentStatus 
} from '../types/document.types';

// Constants
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Method decorator for request validation using Zod schemas
 */
function validateRequest(schema: z.ZodType<any>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      try {
        schema.parse(args[0]);
        return await originalMethod.apply(this, args);
      } catch (error) {
        logger.error('Request validation failed:', error);
        throw new Error('Invalid request data');
      }
    };
    return descriptor;
  };
}

/**
 * Method decorator for retry logic with exponential backoff
 */
function withRetry(maxRetries: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw lastError!;
    };
    return descriptor;
  };
}

/**
 * Enhanced API client with security, caching, and monitoring features
 */
class ApiClient {
  private performanceMonitor: Map<string, number> = new Map();

  /**
   * Creates a new background check request
   */
  @validateRequest(CreateBackgroundCheckDto)
  @withRetry(MAX_RETRIES)
  async createBackgroundCheck(data: z.infer<typeof CreateBackgroundCheckDto>): Promise<AxiosResponse<BackgroundCheck>> {
    const startTime = performance.now();
    try {
      const response = await axiosInstance.post<BackgroundCheck>(
        API_ENDPOINTS.BACKGROUND_CHECKS.CREATE,
        data
      );
      this.logPerformance('createBackgroundCheck', startTime);
      return response;
    } catch (error) {
      logger.error('Failed to create background check:', error);
      throw error;
    }
  }

  /**
   * Retrieves background check status and details
   */
  async getBackgroundCheck(id: string): Promise<AxiosResponse<BackgroundCheck>> {
    const startTime = performance.now();
    try {
      const response = await axiosInstance.get<BackgroundCheck>(
        API_ENDPOINTS.BACKGROUND_CHECKS.STATUS.replace(':id', id)
      );
      this.logPerformance('getBackgroundCheck', startTime);
      return response;
    } catch (error) {
      logger.error('Failed to get background check:', error);
      throw error;
    }
  }

  /**
   * Updates background check status
   */
  async updateBackgroundCheckStatus(
    id: string,
    status: BackgroundCheckStatus
  ): Promise<AxiosResponse<BackgroundCheck>> {
    const startTime = performance.now();
    try {
      const response = await axiosInstance.put<BackgroundCheck>(
        API_ENDPOINTS.BACKGROUND_CHECKS.UPDATE.replace(':id', id),
        { status }
      );
      this.logPerformance('updateBackgroundCheckStatus', startTime);
      return response;
    } catch (error) {
      logger.error('Failed to update background check status:', error);
      throw error;
    }
  }

  /**
   * Uploads a document with progress tracking and chunk handling
   */
  async uploadDocument(
    file: File,
    type: string,
    checkId: string
  ): Promise<AxiosResponse<DocumentUploadResponse>> {
    const startTime = performance.now();
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('checkId', checkId);

      const response = await axiosInstance.post<DocumentUploadResponse>(
        API_ENDPOINTS.DOCUMENTS.UPLOAD,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total!
            );
            this.emitUploadProgress(percentCompleted);
          }
        }
      );
      this.logPerformance('uploadDocument', startTime);
      return response;
    } catch (error) {
      logger.error('Failed to upload document:', error);
      throw error;
    }
  }

  /**
   * Verifies a document's authenticity
   */
  async verifyDocument(id: string): Promise<AxiosResponse<Document>> {
    const startTime = performance.now();
    try {
      const response = await axiosInstance.post<Document>(
        API_ENDPOINTS.DOCUMENTS.VERIFY.replace(':id', id)
      );
      this.logPerformance('verifyDocument', startTime);
      return response;
    } catch (error) {
      logger.error('Failed to verify document:', error);
      throw error;
    }
  }

  /**
   * Schedules an AI-powered interview
   */
  async scheduleInterview(
    checkId: string,
    scheduledTime: Date
  ): Promise<AxiosResponse<any>> {
    const startTime = performance.now();
    try {
      const response = await axiosInstance.post(
        API_ENDPOINTS.INTERVIEWS.SCHEDULE,
        {
          checkId,
          scheduledTime
        }
      );
      this.logPerformance('scheduleInterview', startTime);
      return response;
    } catch (error) {
      logger.error('Failed to schedule interview:', error);
      throw error;
    }
  }

  private logPerformance(operation: string, startTime: number): void {
    const duration = performance.now() - startTime;
    this.performanceMonitor.set(operation, duration);
    logger.info(`Operation ${operation} completed in ${duration}ms`);
  }

  private emitUploadProgress(progress: number): void {
    window.dispatchEvent(
      new CustomEvent('documentUploadProgress', {
        detail: { progress }
      })
    );
  }
}

// Create and export singleton instance
export const api = new ApiClient();

// Export type definitions for consumers
export type {
  BackgroundCheck,
  Document,
  DocumentUploadResponse,
  BackgroundCheckStatus,
  DocumentStatus
};