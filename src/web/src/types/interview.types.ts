// @package zod ^3.22.0
import { z } from 'zod';
import { User } from '../types/user.types';

/**
 * Enum representing possible interview statuses
 * @enum {string}
 */
export enum InterviewStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

/**
 * Enum representing different types of interviews
 * @enum {string}
 */
export enum InterviewType {
  TECHNICAL = 'TECHNICAL',
  BEHAVIORAL = 'BEHAVIORAL',
  MANAGEMENT = 'MANAGEMENT'
}

/**
 * Interface for structured interview questions with AI scoring support
 */
export interface InterviewQuestion {
  id: string;
  text: string;
  type: string;
  category: string;
  expectedDuration: number;
  difficultyLevel: number;
  keywords: string[];
  scoringCriteria: Record<string, number>;
}

/**
 * Interface for candidate responses with comprehensive AI analysis
 */
export interface InterviewResponse {
  questionId: string;
  response: string;
  duration: number;
  sentiment: number;
  keywords: string[];
  confidenceScore: number;
  clarityScore: number;
  technicalAccuracy: number;
  aiAnalysis: Record<string, any>;
}

/**
 * Interface for AI-generated interview analysis with detailed metrics
 */
export interface InterviewAnalysis {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  sentimentTrend: number[];
  keywordAnalysis: Record<string, number>;
  recommendedAction: string;
}

/**
 * Main interface for interview entity with comprehensive AI analysis support
 */
export interface Interview {
  id: string;
  type: InterviewType;
  status: InterviewStatus;
  backgroundCheckId: string;
  candidateId: string;
  scheduledAt: Date;
  duration: number;
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
  analysis: InterviewAnalysis;
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
  expectedDuration: z.number().positive(),
  difficultyLevel: z.number().min(1).max(5),
  keywords: z.array(z.string()),
  scoringCriteria: z.record(z.string(), z.number())
});

/**
 * Zod schema for interview response validation
 */
export const interviewResponseSchema = z.object({
  questionId: z.string().uuid(),
  response: z.string().min(1, 'Response is required'),
  duration: z.number().positive(),
  sentiment: z.number().min(-1).max(1),
  keywords: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  clarityScore: z.number().min(0).max(1),
  technicalAccuracy: z.number().min(0).max(1),
  aiAnalysis: z.record(z.string(), z.any())
});

/**
 * Zod schema for interview analysis validation
 */
export const interviewAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  sentimentTrend: z.array(z.number().min(-1).max(1)),
  keywordAnalysis: z.record(z.string(), z.number()),
  recommendedAction: z.string()
});

/**
 * DTO schema for scheduling new interviews with validation
 */
export const ScheduleInterviewDto = z.object({
  type: z.nativeEnum(InterviewType),
  backgroundCheckId: z.string().uuid(),
  candidateId: z.string().uuid(),
  scheduledAt: z.date(),
  duration: z.number().positive().max(180)
});

/**
 * DTO schema for updating interview status and results with validation
 */
export const UpdateInterviewDto = z.object({
  status: z.nativeEnum(InterviewStatus),
  responses: z.array(interviewResponseSchema).optional(),
  analysis: interviewAnalysisSchema.optional()
});

/**
 * Type guard to check if a value is a valid InterviewStatus
 */
export const isInterviewStatus = (value: unknown): value is InterviewStatus => {
  return Object.values(InterviewStatus).includes(value as InterviewStatus);
};

/**
 * Type guard to check if a value is a valid InterviewType
 */
export const isInterviewType = (value: unknown): value is InterviewType => {
  return Object.values(InterviewType).includes(value as InterviewType);
};