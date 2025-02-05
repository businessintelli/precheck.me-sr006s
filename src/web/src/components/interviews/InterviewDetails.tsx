import React, { useEffect, useCallback, useState } from 'react'; // ^18.0.0
import { format } from 'date-fns'; // ^2.30.0
import { io, Socket } from 'socket.io-client'; // ^4.7.2
import { clsx } from 'clsx'; // ^2.0.0
import Card from '../shared/Card';
import { useInterview } from '../../hooks/useInterview';
import type { Interview, InterviewStatus } from '../../types/interview.types';

// Constants for styling and configuration
const STATUS_COLORS = {
  SCHEDULED: 'text-blue-600 dark:text-blue-400',
  IN_PROGRESS: 'text-yellow-600 dark:text-yellow-400',
  COMPLETED: 'text-green-600 dark:text-green-400',
  CANCELLED: 'text-red-600 dark:text-red-400',
  FAILED: 'text-red-600 dark:text-red-400'
} as const;

const DATE_FORMAT = 'MMM dd, yyyy HH:mm';
const WEBSOCKET_RETRY_ATTEMPTS = 3;
const WEBSOCKET_RETRY_DELAY = 1000;

// Component props interface
interface InterviewDetailsProps {
  interviewId: string;
  className?: string;
}

/**
 * Formats interview status with appropriate styling
 */
const formatInterviewStatus = (status: InterviewStatus): { text: string; className: string } => {
  return {
    text: status.replace('_', ' ').toLowerCase(),
    className: STATUS_COLORS[status] || 'text-gray-600 dark:text-gray-400'
  };
};

/**
 * InterviewDetails component displays comprehensive information about an AI-powered interview
 * with real-time updates and accessibility features
 */
const InterviewDetails: React.FC<InterviewDetailsProps> = ({ interviewId, className }) => {
  // Custom hook for interview management
  const {
    interview,
    loading,
    error,
    updateInterview,
    connectionStatus
  } = useInterview(interviewId, {
    autoConnect: true,
    enableRealtime: true,
    retryOnFailure: true
  });

  // Local state for UI management
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  /**
   * Handles real-time question progress updates
   */
  const handleQuestionProgress = useCallback((currentQuestion: number, totalQuestions: number) => {
    return Math.round((currentQuestion / totalQuestions) * 100);
  }, []);

  /**
   * Renders AI analysis section with confidence scores
   */
  const renderAIAnalysis = useCallback((analysis: Interview['analysis']) => {
    if (!analysis) return null;

    return (
      <div className="space-y-4 mt-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AI Analysis
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 dark:text-gray-400">Overall Score</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {analysis.overallScore}%
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 dark:text-gray-400">Confidence</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {analysis.confidenceScore}%
            </div>
          </div>
        </div>
        
        {analysis.keyInsights.length > 0 && (
          <div className="mt-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
              Key Insights
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              {analysis.keyInsights.map((insight, index) => (
                <li key={index} className="text-gray-600 dark:text-gray-300">
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }, []);

  if (loading.isInitializing) {
    return (
      <Card className={clsx('animate-pulse', className)} aria-busy="true">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={clsx('bg-red-50 dark:bg-red-900/20', className)}>
        <div className="text-red-600 dark:text-red-400">
          <h3 className="text-lg font-medium">Error Loading Interview</h3>
          <p className="text-sm mt-1">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800 rounded-md text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  if (!interview) {
    return (
      <Card className={clsx('text-center py-8', className)}>
        <p className="text-gray-500 dark:text-gray-400">Interview not found</p>
      </Card>
    );
  }

  const status = formatInterviewStatus(interview.status);

  return (
    <Card 
      className={clsx('space-y-6', className)}
      aria-label="Interview Details"
    >
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {interview.type} Interview
          </h2>
          <div className="mt-1 flex items-center space-x-4">
            <span className={clsx('text-sm font-medium', status.className)}>
              {status.text}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {format(new Date(interview.scheduledAt), DATE_FORMAT)}
            </span>
          </div>
        </div>
        
        {connectionStatus.isConnected && (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Live
            </span>
          </div>
        )}
      </div>

      {/* Questions Progress */}
      {interview.questions.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Progress</span>
            <span>
              {interview.responses.length} of {interview.questions.length} Questions
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-500"
              style={{
                width: `${handleQuestionProgress(
                  interview.responses.length,
                  interview.questions.length
                )}%`
              }}
              role="progressbar"
              aria-valuenow={interview.responses.length}
              aria-valuemin={0}
              aria-valuemax={interview.questions.length}
            />
          </div>
        </div>
      )}

      {/* Current Question */}
      {interview.status === 'IN_PROGRESS' && interview.questions[interview.responses.length] && (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Current Question
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {interview.questions[interview.responses.length].text}
          </p>
        </div>
      )}

      {/* AI Analysis */}
      {interview.status === 'COMPLETED' && renderAIAnalysis(interview.analysis)}

      {/* Expandable Details */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        {isExpanded ? 'Show Less' : 'Show More Details'}
      </button>

      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Duration</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {interview.duration} minutes
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {format(new Date(interview.createdAt), DATE_FORMAT)}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default InterviewDetails;