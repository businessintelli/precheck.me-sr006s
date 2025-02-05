/**
 * Core API service for Precheck.me platform
 * Provides typed HTTP client methods with comprehensive error handling,
 * request/response interceptors, authentication, and monitoring
 * @version 1.0.0
 */

import axiosInstance from '../lib/axios'; // ^1.6.0
import type { AxiosResponse } from 'axios'; // ^1.6.0
import { BackgroundCheck, CreateBackgroundCheckDtoType, BackgroundCheckStatus } from '../types/background-check.types';
import { Document, DocumentType, DocumentUploadResponse } from '../types/document.types';
import { Interview, InterviewType, ScheduleInterviewDto } from '../types/interview.types';

// API endpoint constants
const API_ENDPOINTS = {
  BACKGROUND_CHECKS: '/api/v1/background-checks',
  DOCUMENTS: '/api/v1/documents',
  INTERVIEWS: '/api/v1/interviews'
} as const;

// Error messages
const ERROR_MESSAGES = {
  INVALID_ID: 'Invalid ID provided',
  INVALID_DATA: 'Invalid request data',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  SERVER_ERROR: 'Internal server error occurred'
} as const;

/**
 * Core API service class providing typed HTTP methods with enhanced error handling
 */
export class ApiService {
  private readonly axios = axiosInstance;

  /**
   * Retrieves a background check by ID
   * @param id - Background check ID
   * @returns Promise with background check details
   */
  async getBackgroundCheck(id: string): Promise<BackgroundCheck> {
    if (!id) {
      throw new Error(ERROR_MESSAGES.INVALID_ID);
    }

    const response = await this.axios.get<BackgroundCheck>(
      `${API_ENDPOINTS.BACKGROUND_CHECKS}/${id}`
    );
    return response.data;
  }

  /**
   * Creates a new background check
   * @param data - Background check creation data
   * @returns Promise with created background check
   */
  async createBackgroundCheck(data: CreateBackgroundCheckDtoType): Promise<BackgroundCheck> {
    if (!data) {
      throw new Error(ERROR_MESSAGES.INVALID_DATA);
    }

    const response = await this.axios.post<BackgroundCheck>(
      API_ENDPOINTS.BACKGROUND_CHECKS,
      data
    );
    return response.data;
  }

  /**
   * Updates background check status
   * @param id - Background check ID
   * @param status - New status
   * @returns Promise with updated background check
   */
  async updateBackgroundCheckStatus(
    id: string,
    status: BackgroundCheckStatus
  ): Promise<BackgroundCheck> {
    if (!id || !status) {
      throw new Error(ERROR_MESSAGES.INVALID_DATA);
    }

    const response = await this.axios.put<BackgroundCheck>(
      `${API_ENDPOINTS.BACKGROUND_CHECKS}/${id}/status`,
      { status }
    );
    return response.data;
  }

  /**
   * Retrieves a document by ID
   * @param id - Document ID
   * @returns Promise with document details
   */
  async getDocument(id: string): Promise<Document> {
    if (!id) {
      throw new Error(ERROR_MESSAGES.INVALID_ID);
    }

    const response = await this.axios.get<Document>(
      `${API_ENDPOINTS.DOCUMENTS}/${id}`
    );
    return response.data;
  }

  /**
   * Initiates document upload process
   * @param type - Document type
   * @param checkId - Associated background check ID
   * @returns Promise with upload URL and document details
   */
  async initiateDocumentUpload(
    type: DocumentType,
    checkId: string
  ): Promise<DocumentUploadResponse> {
    if (!type || !checkId) {
      throw new Error(ERROR_MESSAGES.INVALID_DATA);
    }

    const response = await this.axios.post<DocumentUploadResponse>(
      `${API_ENDPOINTS.DOCUMENTS}/upload`,
      { type, checkId }
    );
    return response.data;
  }

  /**
   * Schedules a new interview
   * @param data - Interview scheduling data
   * @returns Promise with scheduled interview details
   */
  async scheduleInterview(data: ScheduleInterviewDto): Promise<Interview> {
    if (!data) {
      throw new Error(ERROR_MESSAGES.INVALID_DATA);
    }

    const response = await this.axios.post<Interview>(
      API_ENDPOINTS.INTERVIEWS,
      data
    );
    return response.data;
  }

  /**
   * Retrieves interview details by ID
   * @param id - Interview ID
   * @returns Promise with interview details
   */
  async getInterview(id: string): Promise<Interview> {
    if (!id) {
      throw new Error(ERROR_MESSAGES.INVALID_ID);
    }

    const response = await this.axios.get<Interview>(
      `${API_ENDPOINTS.INTERVIEWS}/${id}`
    );
    return response.data;
  }

  /**
   * Lists background checks with pagination
   * @param page - Page number
   * @param limit - Items per page
   * @returns Promise with paginated background checks
   */
  async listBackgroundChecks(page = 1, limit = 10): Promise<{
    items: BackgroundCheck[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await this.axios.get<{
      items: BackgroundCheck[];
      total: number;
      page: number;
      limit: number;
    }>(API_ENDPOINTS.BACKGROUND_CHECKS, {
      params: { page, limit }
    });
    return response.data;
  }

  /**
   * Lists documents for a background check
   * @param checkId - Background check ID
   * @returns Promise with list of documents
   */
  async listDocuments(checkId: string): Promise<Document[]> {
    if (!checkId) {
      throw new Error(ERROR_MESSAGES.INVALID_ID);
    }

    const response = await this.axios.get<Document[]>(
      `${API_ENDPOINTS.BACKGROUND_CHECKS}/${checkId}/documents`
    );
    return response.data;
  }

  /**
   * Deletes a document
   * @param id - Document ID
   * @returns Promise indicating success
   */
  async deleteDocument(id: string): Promise<void> {
    if (!id) {
      throw new Error(ERROR_MESSAGES.INVALID_ID);
    }

    await this.axios.delete(`${API_ENDPOINTS.DOCUMENTS}/${id}`);
  }

  /**
   * Cancels a scheduled interview
   * @param id - Interview ID
   * @returns Promise with cancelled interview details
   */
  async cancelInterview(id: string): Promise<Interview> {
    if (!id) {
      throw new Error(ERROR_MESSAGES.INVALID_ID);
    }

    const response = await this.axios.post<Interview>(
      `${API_ENDPOINTS.INTERVIEWS}/${id}/cancel`
    );
    return response.data;
  }
}

// Export singleton instance
export const apiService = new ApiService();