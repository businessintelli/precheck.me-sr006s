import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.0.0
import MockAdapter from 'axios-mock-adapter'; // ^1.22.0
import { ApiService } from '../../services/api.service';
import axiosInstance from '../../lib/axios';
import { BackgroundCheckType, BackgroundCheckStatus } from '../../types/background-check.types';
import { DocumentType, DocumentStatus } from '../../types/document.types';
import { InterviewType, InterviewStatus } from '../../types/interview.types';

// Constants for testing
const TEST_TIMEOUT = 5000;
const API_BASE = '/api/v1';
const TEST_UUID = '123e4567-e89b-12d3-a456-426614174000';

// Mock data
const mockBackgroundCheck = {
  id: TEST_UUID,
  type: BackgroundCheckType.STANDARD,
  status: BackgroundCheckStatus.INITIATED,
  candidateId: TEST_UUID,
  organizationId: TEST_UUID,
  requestedBy: TEST_UUID,
  documentIds: [],
  interviewId: '',
  verificationResults: {
    identity: {
      verified: false,
      status: 'pending',
      details: {},
      verifiedAt: new Date(),
      verifiedBy: TEST_UUID
    },
    employment: {
      verified: false,
      status: 'pending',
      details: {},
      verifiedAt: new Date(),
      verifiedBy: TEST_UUID
    },
    education: {
      verified: false,
      status: 'pending',
      details: {},
      verifiedAt: new Date(),
      verifiedBy: TEST_UUID
    },
    criminal: {
      verified: false,
      status: 'pending',
      details: {},
      verifiedAt: new Date(),
      verifiedBy: TEST_UUID
    }
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockDocument = {
  id: TEST_UUID,
  type: DocumentType.GOVERNMENT_ID,
  url: 'https://example.com/doc.pdf',
  status: DocumentStatus.PENDING,
  checkId: TEST_UUID,
  verificationResult: {
    isAuthentic: false,
    confidenceScore: 0,
    verificationMethod: 'AI',
    issues: [],
    extractedText: null,
    metadata: {},
    aiConfidence: 0,
    verifiedBy: '',
    verificationDate: new Date(),
    expiryDate: null
  },
  uploadedAt: new Date(),
  verifiedAt: null,
  fileName: 'doc.pdf',
  fileSize: 1024,
  mimeType: 'application/pdf',
  hash: 'abc123'
};

const mockInterview = {
  id: TEST_UUID,
  type: InterviewType.TECHNICAL,
  status: InterviewStatus.SCHEDULED,
  backgroundCheckId: TEST_UUID,
  candidateId: TEST_UUID,
  scheduledAt: new Date(),
  duration: 60,
  questions: [],
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

describe('ApiService', () => {
  let mockAxios: MockAdapter;
  let apiService: ApiService;

  beforeEach(() => {
    mockAxios = new MockAdapter(axiosInstance);
    apiService = new ApiService();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockAxios.reset();
    jest.clearAllMocks();
  });

  describe('Background Check Operations', () => {
    test('getBackgroundCheck should retrieve check details', async () => {
      mockAxios.onGet(`${API_BASE}/background-checks/${TEST_UUID}`).reply(200, mockBackgroundCheck);

      const result = await apiService.getBackgroundCheck(TEST_UUID);
      expect(result).toEqual(mockBackgroundCheck);
      expect(result.type).toBe(BackgroundCheckType.STANDARD);
    });

    test('createBackgroundCheck should create new check', async () => {
      const createData = {
        type: BackgroundCheckType.STANDARD,
        candidateId: TEST_UUID,
        organizationId: TEST_UUID
      };

      mockAxios.onPost(`${API_BASE}/background-checks`).reply(201, mockBackgroundCheck);

      const result = await apiService.createBackgroundCheck(createData);
      expect(result).toEqual(mockBackgroundCheck);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify(createData));
    });

    test('listBackgroundChecks should handle pagination', async () => {
      const mockResponse = {
        items: [mockBackgroundCheck],
        total: 1,
        page: 1,
        limit: 10
      };

      mockAxios.onGet(`${API_BASE}/background-checks`).reply(200, mockResponse);

      const result = await apiService.listBackgroundChecks(1, 10);
      expect(result).toEqual(mockResponse);
      expect(mockAxios.history.get[0].params).toEqual({ page: 1, limit: 10 });
    });
  });

  describe('Document Management', () => {
    test('getDocument should retrieve document details', async () => {
      mockAxios.onGet(`${API_BASE}/documents/${TEST_UUID}`).reply(200, mockDocument);

      const result = await apiService.getDocument(TEST_UUID);
      expect(result).toEqual(mockDocument);
      expect(result.type).toBe(DocumentType.GOVERNMENT_ID);
    });

    test('initiateDocumentUpload should return upload URL', async () => {
      const mockUploadResponse = {
        document: mockDocument,
        uploadUrl: 'https://example.com/upload',
        expiresIn: 3600,
        maxSize: 10485760,
        allowedTypes: ['application/pdf']
      };

      mockAxios.onPost(`${API_BASE}/documents/upload`).reply(200, mockUploadResponse);

      const result = await apiService.initiateDocumentUpload(DocumentType.GOVERNMENT_ID, TEST_UUID);
      expect(result).toEqual(mockUploadResponse);
      expect(result.uploadUrl).toBeTruthy();
    });

    test('listDocuments should return documents for background check', async () => {
      mockAxios.onGet(`${API_BASE}/background-checks/${TEST_UUID}/documents`).reply(200, [mockDocument]);

      const result = await apiService.listDocuments(TEST_UUID);
      expect(result).toEqual([mockDocument]);
      expect(result[0].type).toBe(DocumentType.GOVERNMENT_ID);
    });
  });

  describe('Interview Management', () => {
    test('scheduleInterview should create interview slot', async () => {
      const scheduleData = {
        type: InterviewType.TECHNICAL,
        backgroundCheckId: TEST_UUID,
        candidateId: TEST_UUID,
        scheduledAt: new Date(),
        duration: 60
      };

      mockAxios.onPost(`${API_BASE}/interviews`).reply(201, mockInterview);

      const result = await apiService.scheduleInterview(scheduleData);
      expect(result).toEqual(mockInterview);
      expect(mockAxios.history.post[0].data).toBe(JSON.stringify(scheduleData));
    });

    test('getInterview should retrieve interview details', async () => {
      mockAxios.onGet(`${API_BASE}/interviews/${TEST_UUID}`).reply(200, mockInterview);

      const result = await apiService.getInterview(TEST_UUID);
      expect(result).toEqual(mockInterview);
      expect(result.type).toBe(InterviewType.TECHNICAL);
    });
  });

  describe('Error Handling', () => {
    test('should handle 401 unauthorized error', async () => {
      mockAxios.onGet(`${API_BASE}/background-checks/${TEST_UUID}`).reply(401);

      await expect(apiService.getBackgroundCheck(TEST_UUID)).rejects.toThrow('Unauthorized access');
    });

    test('should handle 404 not found error', async () => {
      mockAxios.onGet(`${API_BASE}/documents/${TEST_UUID}`).reply(404);

      await expect(apiService.getDocument(TEST_UUID)).rejects.toThrow('Resource not found');
    });

    test('should handle rate limiting', async () => {
      mockAxios.onGet(`${API_BASE}/interviews/${TEST_UUID}`).reply(429, null, {
        'Retry-After': '60'
      });

      await expect(apiService.getInterview(TEST_UUID)).rejects.toThrow(/Too many requests/);
    });

    test('should handle network errors', async () => {
      mockAxios.onPost(`${API_BASE}/documents/upload`).networkError();

      await expect(
        apiService.initiateDocumentUpload(DocumentType.GOVERNMENT_ID, TEST_UUID)
      ).rejects.toThrow();
    });
  });

  describe('Request Validation', () => {
    test('should validate required parameters', async () => {
      await expect(apiService.getBackgroundCheck('')).rejects.toThrow('Invalid ID provided');
      await expect(apiService.getDocument('')).rejects.toThrow('Invalid ID provided');
      await expect(apiService.getInterview('')).rejects.toThrow('Invalid ID provided');
    });

    test('should validate request payload', async () => {
      const invalidData = {} as any;
      await expect(apiService.createBackgroundCheck(invalidData)).rejects.toThrow('Invalid request data');
      await expect(apiService.scheduleInterview(invalidData)).rejects.toThrow('Invalid request data');
    });
  });

  describe('Response Transformation', () => {
    test('should transform date fields correctly', async () => {
      const mockResponse = { ...mockBackgroundCheck, createdAt: '2024-01-01T00:00:00Z' };
      mockAxios.onGet(`${API_BASE}/background-checks/${TEST_UUID}`).reply(200, mockResponse);

      const result = await apiService.getBackgroundCheck(TEST_UUID);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test('should handle null values in response', async () => {
      const mockResponse = { ...mockDocument, verifiedAt: null };
      mockAxios.onGet(`${API_BASE}/documents/${TEST_UUID}`).reply(200, mockResponse);

      const result = await apiService.getDocument(TEST_UUID);
      expect(result.verifiedAt).toBeNull();
    });
  });
});