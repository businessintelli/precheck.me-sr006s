import React, { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { useErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import VideoStream from './VideoStream';
import { useInterview, InterviewError } from '../../hooks/useInterview';
import { useWebSocket, WebSocketStatus } from '../../hooks/useWebSocket';
import { Loading } from '../shared/Loading';
import { cn } from '../../lib/utils';
import { Interview, InterviewStatus, InterviewQuestion, InterviewResponse, InterviewAnalysis } from '../../types/interview.types';
import { NotificationType } from '../../types/notification.types';

// Constants for interview configuration
const QUESTION_TIME_LIMIT = 180; // 3 minutes per question
const AUDIO_THRESHOLD = 0.1;
const RECONNECTION_ATTEMPTS = 3;
const STREAM_QUALITY_LEVELS = {
  low: { width: 640, height: 480, frameRate: 24 },
  medium: { width: 1280, height: 720, frameRate: 30 },
  high: { width: 1920, height: 1080, frameRate: 30 }
};

// Error codes for different failure scenarios
const ERROR_CODES = {
  network: 'NETWORK_ERROR',
  media: 'MEDIA_ERROR',
  server: 'SERVER_ERROR'
} as const;

interface InterviewConfig {
  timeLimit: number;
  audioThreshold: number;
  streamQuality: keyof typeof STREAM_QUALITY_LEVELS;
  enableTranscription: boolean;
}

interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  announceQuestions: boolean;
  highContrastMode: boolean;
}

interface ThemeConfig {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
}

interface InterviewPortalProps {
  interviewId: string;
  onComplete: (analysis: InterviewAnalysis) => void;
  onError: (error: InterviewError) => void;
  config?: Partial<InterviewConfig>;
  accessibility?: Partial<AccessibilityConfig>;
  theme?: Partial<ThemeConfig>;
}

const InterviewPortal: React.FC<InterviewPortalProps> = React.memo(({
  interviewId,
  onComplete,
  onError,
  config = {},
  accessibility = {},
  theme = {}
}) => {
  // State management
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs for timers and audio analysis
  const timerRef = useRef<NodeJS.Timeout>();
  const audioAnalyzerRef = useRef<AnalyserNode | null>(null);

  // Custom hooks for interview and WebSocket management
  const {
    interview,
    loading,
    error: interviewError,
    updateInterview
  } = useInterview(interviewId);

  const {
    isConnected,
    connectionState,
    subscribe,
    unsubscribe
  } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  const { showBoundary } = useErrorBoundary();

  // Merge configuration with defaults
  const mergedConfig: InterviewConfig = {
    timeLimit: QUESTION_TIME_LIMIT,
    audioThreshold: AUDIO_THRESHOLD,
    streamQuality: 'medium',
    enableTranscription: true,
    ...config
  };

  // Handle stream ready event
  const handleStreamReady = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyzer = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyzer);
    analyzer.fftSize = 256;
    audioAnalyzerRef.current = analyzer;

    setIsRecording(true);
  }, []);

  // Handle stream error
  const handleStreamError = useCallback((error: Error) => {
    onError({
      code: ERROR_CODES.media,
      message: 'Failed to initialize media stream',
      details: error.message
    });
  }, [onError]);

  // Monitor audio levels
  const monitorAudioLevel = useCallback(() => {
    if (!audioAnalyzerRef.current || !isRecording) return;

    const dataArray = new Uint8Array(audioAnalyzerRef.current.frequencyBinCount);
    audioAnalyzerRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    const normalizedLevel = average / 255;

    setAudioLevel(normalizedLevel);

    if (normalizedLevel < mergedConfig.audioThreshold) {
      // Trigger low audio warning
      console.warn('Low audio level detected');
    }
  }, [isRecording, mergedConfig.audioThreshold]);

  // Handle question transition
  const handleNextQuestion = useCallback(async () => {
    if (!interview?.questions) return;

    const currentIndex = interview.questions.findIndex(q => q.id === currentQuestion?.id);
    const nextQuestion = interview.questions[currentIndex + 1];

    if (nextQuestion) {
      setCurrentQuestion(nextQuestion);
      setTimeRemaining(mergedConfig.timeLimit);
    } else {
      // Interview completed
      try {
        const updatedInterview = await updateInterview(InterviewStatus.COMPLETED, {
          responses,
          completedAt: new Date()
        });
        
        if (updatedInterview.analysis) {
          onComplete(updatedInterview.analysis);
        }
      } catch (error) {
        onError({
          code: ERROR_CODES.server,
          message: 'Failed to complete interview',
          details: error
        });
      }
    }
  }, [interview, currentQuestion, responses, mergedConfig.timeLimit, updateInterview, onComplete, onError]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((
    event: NotificationType,
    data: unknown
  ) => {
    if (event === NotificationType.INTERVIEW_READY) {
      // Handle real-time updates
      console.debug('Received interview update:', data);
    }
  }, []);

  // Initialize interview session
  useEffect(() => {
    if (interview && !currentQuestion) {
      setCurrentQuestion(interview.questions[0]);
      setTimeRemaining(mergedConfig.timeLimit);
    }
  }, [interview, currentQuestion, mergedConfig.timeLimit]);

  // Setup WebSocket subscription
  useEffect(() => {
    subscribe(NotificationType.INTERVIEW_READY, handleWebSocketMessage);
    return () => unsubscribe(NotificationType.INTERVIEW_READY, handleWebSocketMessage);
  }, [subscribe, unsubscribe, handleWebSocketMessage]);

  // Timer management
  useEffect(() => {
    if (timeRemaining > 0 && isRecording) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleNextQuestion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [timeRemaining, isRecording, handleNextQuestion]);

  // Audio monitoring
  useEffect(() => {
    let animationFrame: number;
    
    const updateAudioLevel = () => {
      monitorAudioLevel();
      animationFrame = requestAnimationFrame(updateAudioLevel);
    };

    if (isRecording) {
      updateAudioLevel();
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isRecording, monitorAudioLevel]);

  // Error handling
  useEffect(() => {
    if (interviewError) {
      showBoundary(interviewError);
    }
  }, [interviewError, showBoundary]);

  if (loading.isInitializing) {
    return (
      <Loading 
        size="lg"
        text="Initializing interview session..."
        ariaLabel="Initializing interview"
      />
    );
  }

  return (
    <div 
      className={cn(
        "flex flex-col h-full rounded-lg overflow-hidden",
        "bg-background text-foreground",
        theme.backgroundColor
      )}
      role="main"
      aria-live="polite"
    >
      {/* Video stream container */}
      <div className="relative flex-1">
        <VideoStream
          interviewId={interviewId}
          onStreamReady={handleStreamReady}
          onStreamError={handleStreamError}
          className="w-full h-full"
          quality={STREAM_QUALITY_LEVELS[mergedConfig.streamQuality]}
          audioThreshold={mergedConfig.audioThreshold}
          onAudioLevel={setAudioLevel}
        />
        
        {/* Audio level indicator */}
        <div 
          className="absolute bottom-4 left-4 flex items-center gap-2"
          role="meter"
          aria-label="Audio level"
          aria-valuenow={Math.round(audioLevel * 100)}
        >
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question and controls section */}
      <div className="p-4 border-t border-border">
        {currentQuestion && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                Question {interview?.questions.findIndex(q => q.id === currentQuestion.id) + 1} of {interview?.questions.length}
              </h2>
              <div className="text-lg font-mono">
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <p className="text-lg">{currentQuestion.text}</p>

            <div className="flex justify-between items-center">
              <button
                className={cn(
                  "px-4 py-2 rounded-md",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary/90 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                onClick={handleNextQuestion}
                disabled={!isRecording || timeRemaining === 0}
              >
                Next Question
              </button>

              {!isConnected && (
                <div className="text-destructive" role="alert">
                  Connection lost. Attempting to reconnect...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

InterviewPortal.displayName = 'InterviewPortal';

export default InterviewPortal;
export type { InterviewPortalProps };