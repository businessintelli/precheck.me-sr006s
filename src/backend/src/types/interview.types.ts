// @package zod version ^3.22.0
import { z } from 'zod';
import { User } from './user.types';

/**
 * Enum for tracking interview process statuses throughout the lifecycle
 */
export enum InterviewStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  PENDING_REVIEW = 'PENDING_REVIEW'
}

/**
 * Enum for different categories of AI-powered interviews
 */
export enum InterviewType {
  TECHNICAL = 'TECHNICAL',
  BEHAVIORAL = 'BEHAVIORAL',
  MANAGEMENT = 'MANAGEMENT',
  PROBLEM_SOLVING = 'PROBLEM_SOLVING',
  COMMUNICATION = 'COMMUNICATION'
}

/**
 * Interface for AI-optimized interview questions with scoring criteria
 */
export interface InterviewQuestion {
  id: string;
  text: string;
  type: string;
  category: string;
  difficulty: number;
  expectedDuration: number;
  scoringCriteria: Record<string, number>;
  keywords: string[];
}

/**
 * Interface for AI-analyzed candidate responses with detailed metrics
 */
export interface InterviewResponse {
  questionId: string;
  response: string;
  audioUrl: string;
  duration: number;
  sentiment: number;
  confidence: number;
  clarity: number;
  keywords: string[];
  transcription: string;
}

/**
 * Comprehensive interface for AI-generated interview analysis and scoring
 */
export interface InterviewAnalysis {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  cultureFitScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keywordMatches: Record<string, number>;
  aiConfidence: number;
}

/**
 * Comprehensive interface for interview entity with AI analysis capabilities
 */
export interface Interview {
  id: string;
  type: InterviewType;
  status: InterviewStatus;
  backgroundCheckId: string;
  candidateId: string;
  organizationId: string;
  scheduledAt: Date;
  duration: number;
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
  analysis: InterviewAnalysis;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Zod schema for interview question validation
 */
export const interviewQuestionSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1, 'Question text is required'),
  type: z.string(),
  category: z.string(),
  difficulty: z.number().min(1).max(5),
  expectedDuration: z.number().positive(),
  scoringCriteria: z.record(z.number()),
  keywords: z.array(z.string())
});

/**
 * Zod schema for interview response validation
 */
export const interviewResponseSchema = z.object({
  questionId: z.string().uuid(),
  response: z.string(),
  audioUrl: z.string().url(),
  duration: z.number().positive(),
  sentiment: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  clarity: z.number().min(0).max(1),
  keywords: z.array(z.string()),
  transcription: z.string()
});

/**
 * Zod schema for interview analysis validation
 */
export const interviewAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  problemSolvingScore: z.number().min(0).max(100),
  cultureFitScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  keywordMatches: z.record(z.number()),
  aiConfidence: z.number().min(0).max(1)
});

/**
 * DTO schema for scheduling new AI-powered interviews
 */
export const ScheduleInterviewDto = z.object({
  type: z.nativeEnum(InterviewType),
  backgroundCheckId: z.string().uuid(),
  candidateId: z.string().uuid(),
  organizationId: z.string().uuid(),
  scheduledAt: z.date(),
  duration: z.number().positive()
});

/**
 * DTO schema for updating interview progress and AI analysis results
 */
export const UpdateInterviewDto = z.object({
  status: z.nativeEnum(InterviewStatus),
  responses: z.array(interviewResponseSchema),
  analysis: interviewAnalysisSchema,
  metadata: z.record(z.unknown())
});

/**
 * Type guard to check if a value is a valid InterviewStatus
 */
export const isInterviewStatus = (value: any): value is InterviewStatus => {
  return Object.values(InterviewStatus).includes(value as InterviewStatus);
};

/**
 * Type guard to check if a value is a valid InterviewType
 */
export const isInterviewType = (value: any): value is InterviewType => {
  return Object.values(InterviewType).includes(value as InterviewType);
};