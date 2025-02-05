import React, { useEffect, useRef, useState, useCallback } from 'react'; // ^18.0.0
import { useWebSocket } from '../../hooks/useWebSocket';
import { Loading } from '../shared/Loading';
import { InterviewStatus } from '../../types/interview.types';
import { cn } from '../../lib/utils';

// Media constraints for HD video quality
const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280, min: 640 },
    height: { ideal: 720, min: 480 },
    frameRate: { ideal: 30, min: 24 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// Constants for performance optimization
const AUDIO_MONITORING_INTERVAL = 16.67; // ~60fps for smooth audio level updates
const RECONNECTION_ATTEMPTS = 3;
const QUALITY_CHECK_INTERVAL = 5000; // Check stream quality every 5 seconds

interface VideoStreamProps {
  interviewId: string;
  onStreamReady: (stream: MediaStream) => void;
  onStreamError: (error: Error) => void;
  className?: string;
  quality?: {
    width: number;
    height: number;
    frameRate: number;
  };
  audioThreshold?: number;
  onAudioLevel?: (level: number) => void;
  onConnectionStatus?: (status: InterviewStatus) => void;
}

/**
 * Enhanced video streaming component for AI-powered interviews with accessibility support
 */
const VideoStream = React.memo(({
  interviewId,
  onStreamReady,
  onStreamError,
  className,
  quality,
  audioThreshold = 0.1,
  onAudioLevel,
  onConnectionStatus
}: VideoStreamProps): JSX.Element => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { isConnected, connect, disconnect } = useWebSocket({
    autoConnect: false,
    onOpen: () => onConnectionStatus?.(InterviewStatus.IN_PROGRESS),
    onClose: () => onConnectionStatus?.(InterviewStatus.CONNECTING),
    onError: () => onConnectionStatus?.(InterviewStatus.ERROR)
  });

  /**
   * Initialize media stream with quality constraints and error handling
   */
  const initializeStream = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        ...MEDIA_CONSTRAINTS,
        video: {
          ...MEDIA_CONSTRAINTS.video,
          ...(quality && {
            width: { ideal: quality.width },
            height: { ideal: quality.height },
            frameRate: { ideal: quality.frameRate }
          })
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        onStreamReady(stream);
      }

      // Initialize audio monitoring
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setIsInitializing(false);
      connect();

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize stream');
      setError(error);
      onStreamError(error);
    }
  }, [quality, onStreamReady, onStreamError, connect]);

  /**
   * Monitor audio levels using requestAnimationFrame for performance
   */
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      analyserRef.current?.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
      const normalizedLevel = average / 255;

      if (normalizedLevel > audioThreshold) {
        onAudioLevel?.(normalizedLevel);
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, [audioThreshold, onAudioLevel]);

  /**
   * Check stream quality periodically
   */
  const checkStreamQuality = useCallback(() => {
    if (!streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    const settings = videoTrack.getSettings();

    // Log quality metrics for monitoring
    console.debug('Stream quality:', {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      bitrate: videoTrack.getConstraints()
    });
  }, []);

  // Initialize stream and setup cleanup
  useEffect(() => {
    initializeStream();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      disconnect();
    };
  }, [initializeStream, disconnect]);

  // Setup audio monitoring
  useEffect(() => {
    if (!isInitializing && !error) {
      monitorAudioLevel();
    }
  }, [isInitializing, error, monitorAudioLevel]);

  // Setup quality monitoring
  useEffect(() => {
    if (!isInitializing && !error) {
      const interval = setInterval(checkStreamQuality, QUALITY_CHECK_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [isInitializing, error, checkStreamQuality]);

  if (error) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-destructive/10 rounded-lg p-4",
          className
        )}
        role="alert"
        aria-live="assertive"
      >
        <p className="text-destructive">
          Failed to initialize video stream: {error.message}
        </p>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <Loading 
        size="lg"
        text="Initializing video stream..."
        className={className}
        ariaLabel="Initializing video stream"
      />
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        onLoadedMetadata={() => videoRef.current?.play()}
        aria-label="Interview video stream"
      />
      {!isConnected && (
        <div 
          className="absolute inset-0 bg-background/80 flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <Loading 
            size="md"
            text="Reconnecting..."
            ariaLabel="Attempting to reconnect video stream"
          />
        </div>
      )}
    </div>
  );
});

VideoStream.displayName = 'VideoStream';

export default VideoStream;