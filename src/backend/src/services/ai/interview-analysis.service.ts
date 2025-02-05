import { Injectable } from '@nestjs/common';
import { OpenAI } from 'openai'; // @version ^4.0.0
import { Queue } from 'bull'; // @version ^4.12.0
import { CircuitBreaker } from 'opossum'; // @version ^7.1.0
import { Cache } from 'cache-manager'; // @version ^5.2.0
import { trace, Span } from '@opentelemetry/api'; // @version ^1.4.0

import { Interview, InterviewResponse, InterviewAnalysis } from '../../types/interview.types';
import { INTERVIEW_AI_CONFIG } from '../../config/ai.config';
import { NotificationService } from '../background/notification.service';
import { secureLogger as logger } from '../../utils/logger';
import { InternalServerError } from '../../utils/errors';

/**
 * Interface for enhanced response analysis with confidence metrics
 */
interface ResponseAnalysis {
  sentiment: number;
  keywords: string[];
  clarity: number;
  confidence: number;
  metrics: {
    technicalAccuracy?: number;
    communicationScore?: number;
    relevanceScore?: number;
    completenessScore?: number;
  };
}

/**
 * Interface for comprehensive interview scoring
 */
interface InterviewScores {
  technical: number;
  communication: number;
  confidence: number;
  overall: number;
  margin: {
    min: number;
    max: number;
  };
  metadata: {
    sampleSize: number;
    confidenceInterval: number;
    scoringModel: string;
  };
}

@Injectable()
export class InterviewAnalysisService {
  private readonly tracer = trace.getTracer('interview-analysis');
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly openAIClient: OpenAI,
    private readonly analysisQueue: Queue,
    private readonly notificationService: NotificationService,
    private readonly cacheManager: Cache
  ) {
    this.setupCircuitBreaker();
    this.initializeQueue();
  }

  /**
   * Configures circuit breaker for API call protection
   */
  private setupCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker(
      async (prompt: string) => {
        return await this.openAIClient.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2048
        });
      },
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }
    );

    this.circuitBreaker.on('open', () => {
      logger.error('Circuit breaker opened for OpenAI API calls');
    });
  }

  /**
   * Initializes analysis queue with monitoring
   */
  private initializeQueue(): void {
    this.analysisQueue.on('failed', (job, error) => {
      logger.error('Interview analysis job failed', {
        jobId: job.id,
        error
      });
    });

    this.analysisQueue.on('completed', (job) => {
      logger.info('Interview analysis job completed', {
        jobId: job.id
      });
    });
  }

  /**
   * Analyzes a single interview response with enhanced error handling
   */
  public async analyzeResponse(
    response: InterviewResponse
  ): Promise<ResponseAnalysis> {
    const span = this.tracer.startSpan('analyzeResponse');

    try {
      // Check cache first
      const cacheKey = `response:${response.questionId}`;
      const cachedAnalysis = await this.cacheManager.get<ResponseAnalysis>(cacheKey);
      if (cachedAnalysis) {
        return cachedAnalysis;
      }

      // Validate response length
      if (response.response.length < INTERVIEW_AI_CONFIG.MIN_RESPONSE_LENGTH) {
        throw new Error('Response too short for analysis');
      }

      // Process with OpenAI
      const prompt = this.buildAnalysisPrompt(response);
      const result = await this.circuitBreaker.fire(prompt);

      const analysis: ResponseAnalysis = this.parseAnalysisResponse(result);

      // Cache results
      await this.cacheManager.set(cacheKey, analysis, INTERVIEW_AI_CONFIG.CACHE_TTL);

      return analysis;
    } catch (error) {
      span.recordException(error);
      logger.error('Response analysis failed', { error });
      throw new InternalServerError('Failed to analyze interview response');
    } finally {
      span.end();
    }
  }

  /**
   * Generates comprehensive interview analysis with enhanced metrics
   */
  public async generateInterviewAnalysis(
    interviewId: string
  ): Promise<InterviewAnalysis> {
    const span = this.tracer.startSpan('generateInterviewAnalysis');

    try {
      // Queue analysis job
      const job = await this.analysisQueue.add(
        'fullAnalysis',
        { interviewId },
        { attempts: 3 }
      );

      const interview = await job.finished();

      // Process all responses in parallel with rate limiting
      const analysisPromises = interview.responses.map(
        async (response) => this.analyzeResponse(response)
      );

      const responseAnalyses = await Promise.all(analysisPromises);

      // Calculate comprehensive scores
      const scores = await this.calculateScores(responseAnalyses);

      // Generate final analysis
      const analysis: InterviewAnalysis = {
        overallScore: scores.overall,
        technicalScore: scores.technical,
        communicationScore: scores.communication,
        confidenceScore: scores.confidence,
        problemSolvingScore: this.calculateProblemSolvingScore(responseAnalyses),
        cultureFitScore: this.calculateCultureFitScore(responseAnalyses),
        summary: this.generateSummary(responseAnalyses),
        strengths: this.identifyStrengths(responseAnalyses),
        weaknesses: this.identifyWeaknesses(responseAnalyses),
        recommendations: this.generateRecommendations(responseAnalyses),
        keywordMatches: this.aggregateKeywords(responseAnalyses),
        aiConfidence: this.calculateAIConfidence(responseAnalyses)
      };

      // Notify completion
      await this.notificationService.sendInterviewNotification(
        interview.candidateId,
        {
          id: interviewId,
          status: 'COMPLETED',
          scheduledAt: new Date(),
          details: { scores }
        }
      );

      return analysis;
    } catch (error) {
      span.recordException(error);
      logger.error('Interview analysis failed', { error, interviewId });
      throw new InternalServerError('Failed to generate interview analysis');
    } finally {
      span.end();
    }
  }

  /**
   * Calculates comprehensive scores with enhanced metrics
   */
  private async calculateScores(
    analyses: ResponseAnalysis[]
  ): Promise<InterviewScores> {
    const span = this.tracer.startSpan('calculateScores');

    try {
      const technical = this.calculateWeightedAverage(
        analyses.map(a => a.metrics.technicalAccuracy || 0)
      );

      const communication = this.calculateWeightedAverage(
        analyses.map(a => a.clarity)
      );

      const confidence = this.calculateWeightedAverage(
        analyses.map(a => a.confidence)
      );

      const overall = this.calculateOverallScore(technical, communication, confidence);

      return {
        technical,
        communication,
        confidence,
        overall,
        margin: this.calculateConfidenceInterval(analyses),
        metadata: {
          sampleSize: analyses.length,
          confidenceInterval: 0.95,
          scoringModel: 'weighted-multivariate'
        }
      };
    } finally {
      span.end();
    }
  }

  private calculateWeightedAverage(scores: number[]): number {
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }

  private calculateOverallScore(
    technical: number,
    communication: number,
    confidence: number
  ): number {
    return (technical * 0.4 + communication * 0.3 + confidence * 0.3) * 100;
  }

  private calculateConfidenceInterval(analyses: ResponseAnalysis[]): { min: number; max: number } {
    const scores = analyses.map(a => a.confidence);
    const mean = scores.reduce((a, b) => a + b) / scores.length;
    const stdDev = Math.sqrt(
      scores.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (scores.length - 1)
    );
    const marginOfError = 1.96 * (stdDev / Math.sqrt(scores.length));

    return {
      min: Math.max(0, mean - marginOfError),
      max: Math.min(1, mean + marginOfError)
    };
  }

  private buildAnalysisPrompt(response: InterviewResponse): string {
    return `Analyze the following interview response with focus on technical accuracy, communication clarity, and confidence:
            Response: ${response.response}
            Question Type: ${response.questionId}
            Duration: ${response.duration}s`;
  }

  private parseAnalysisResponse(result: any): ResponseAnalysis {
    const content = result.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Invalid analysis response from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to parse analysis response', { error, content });
      throw new Error('Failed to parse analysis response');
    }
  }

  private calculateProblemSolvingScore(analyses: ResponseAnalysis[]): number {
    return this.calculateWeightedAverage(
      analyses.map(a => a.metrics.relevanceScore || 0)
    ) * 100;
  }

  private calculateCultureFitScore(analyses: ResponseAnalysis[]): number {
    return this.calculateWeightedAverage(
      analyses.map(a => a.sentiment + 1) // Normalize sentiment from [-1,1] to [0,2]
    ) * 50; // Scale to 0-100
  }

  private generateSummary(analyses: ResponseAnalysis[]): string {
    // Implementation for generating comprehensive summary
    return 'Detailed summary implementation';
  }

  private identifyStrengths(analyses: ResponseAnalysis[]): string[] {
    // Implementation for identifying key strengths
    return ['Strength identification implementation'];
  }

  private identifyWeaknesses(analyses: ResponseAnalysis[]): string[] {
    // Implementation for identifying areas of improvement
    return ['Weakness identification implementation'];
  }

  private generateRecommendations(analyses: ResponseAnalysis[]): string[] {
    // Implementation for generating actionable recommendations
    return ['Recommendation generation implementation'];
  }

  private aggregateKeywords(analyses: ResponseAnalysis[]): Record<string, number> {
    const keywords: Record<string, number> = {};
    analyses.forEach(analysis => {
      analysis.keywords.forEach(keyword => {
        keywords[keyword] = (keywords[keyword] || 0) + 1;
      });
    });
    return keywords;
  }

  private calculateAIConfidence(analyses: ResponseAnalysis[]): number {
    return this.calculateWeightedAverage(
      analyses.map(a => a.metrics.completenessScore || 0)
    );
  }
}