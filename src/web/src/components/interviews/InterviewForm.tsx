// @package react ^18.0.0
// @package zod ^3.22.0
// @package react-toastify ^9.1.3

import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import { z } from 'zod';
import Form from '../shared/Form';
import Input from '../shared/Input';
import Select from '../shared/Select';
import { useInterview } from '../../hooks/useInterview';
import { InterviewType } from '../../types/interview.types';
import { cn } from '../../lib/utils';

// Enhanced validation schema for interview scheduling
const scheduleInterviewSchema = z.object({
  type: z.nativeEnum(InterviewType, {
    errorMap: () => ({ message: 'Please select a valid interview type' })
  }),
  scheduledAt: z.date({
    required_error: 'Please select an interview date and time',
    invalid_type_error: 'Invalid date format'
  }).refine(
    (date) => date > new Date(),
    'Interview must be scheduled in the future'
  ),
  duration: z.number({
    required_error: 'Please specify interview duration',
    invalid_type_error: 'Duration must be a number'
  }).min(15, 'Minimum duration is 15 minutes')
    .max(180, 'Maximum duration is 180 minutes'),
  notes: z.string().optional()
});

type ScheduleInterviewFormData = z.infer<typeof scheduleInterviewSchema>;

// Props interface with strict typing
interface InterviewFormProps {
  backgroundCheckId: string;
  candidateId: string;
  onSuccess: (interview: any) => void;
  className?: string;
}

// Interview type options with descriptions
const interviewTypeOptions = [
  {
    label: 'Technical Interview',
    value: InterviewType.TECHNICAL,
    description: 'Technical skills and problem-solving assessment'
  },
  {
    label: 'Behavioral Interview',
    value: InterviewType.BEHAVIORAL,
    description: 'Soft skills and past experience evaluation'
  },
  {
    label: 'Management Interview',
    value: InterviewType.MANAGEMENT,
    description: 'Leadership and management capabilities assessment'
  }
];

const InterviewForm: React.FC<InterviewFormProps> = ({
  backgroundCheckId,
  candidateId,
  onSuccess,
  className
}) => {
  // State for real-time connection status
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize interview hook with real-time updates
  const {
    scheduleInterview,
    loading,
    error,
    connectionStatus
  } = useInterview(undefined, {
    autoConnect: true,
    enableRealtime: true,
    retryOnFailure: true
  });

  // Handle WebSocket connection status changes
  useEffect(() => {
    if (!connectionStatus.isConnected && !isConnecting) {
      toast.warning('Attempting to establish real-time connection...', {
        toastId: 'ws-connecting'
      });
      setIsConnecting(true);
    } else if (connectionStatus.isConnected && isConnecting) {
      toast.success('Real-time connection established', {
        toastId: 'ws-connected'
      });
      setIsConnecting(false);
    }
  }, [connectionStatus.isConnected, isConnecting]);

  // Enhanced form submission handler with validation and error handling
  const handleSubmit = useCallback(async (data: ScheduleInterviewFormData) => {
    try {
      const interview = await scheduleInterview({
        type: data.type,
        backgroundCheckId,
        candidateId,
        scheduledAt: data.scheduledAt,
        duration: data.duration
      });

      toast.success('Interview scheduled successfully', {
        position: 'top-right',
        autoClose: 3000
      });

      onSuccess(interview);
    } catch (err) {
      console.error('Interview scheduling failed:', err);
      toast.error('Failed to schedule interview. Please try again.', {
        position: 'top-right',
        autoClose: 5000
      });
    }
  }, [backgroundCheckId, candidateId, onSuccess, scheduleInterview]);

  // Calculate minimum date for scheduling (now + 1 hour)
  const minScheduleDate = new Date();
  minScheduleDate.setHours(minScheduleDate.getHours() + 1);

  return (
    <Form
      schema={scheduleInterviewSchema}
      onSubmit={handleSubmit}
      className={cn(
        'space-y-6 w-full max-w-md mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md',
        loading.isScheduling && 'opacity-70 pointer-events-none',
        className
      )}
    >
      <div className="space-y-2">
        <Select
          options={interviewTypeOptions}
          value=""
          onChange={() => {}}
          placeholder="Select Interview Type"
          disabled={loading.isScheduling}
          error={error?.message}
          aria-label="Interview Type"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="datetime-local"
          label="Interview Date & Time"
          min={minScheduleDate.toISOString().slice(0, 16)}
          required
          disabled={loading.isScheduling}
          error={error?.message}
        />
      </div>

      <div className="space-y-2">
        <Input
          type="number"
          label="Duration (minutes)"
          min={15}
          max={180}
          step={15}
          defaultValue={60}
          required
          disabled={loading.isScheduling}
          error={error?.message}
          helperText="Interview duration between 15 and 180 minutes"
        />
      </div>

      <div className="space-y-2">
        <Input
          type="text"
          label="Additional Notes"
          placeholder="Optional notes for the interview"
          disabled={loading.isScheduling}
        />
      </div>

      <button
        type="submit"
        disabled={loading.isScheduling}
        className={cn(
          'w-full px-4 py-2 text-sm font-medium text-white',
          'bg-primary-600 dark:bg-primary-500 rounded-md',
          'hover:bg-primary-700 dark:hover:bg-primary-600',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'focus:ring-primary-500 dark:focus:ring-primary-400',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors duration-200'
        )}
      >
        {loading.isScheduling ? 'Scheduling...' : 'Schedule Interview'}
      </button>

      {error && (
        <div
          role="alert"
          className="text-sm text-red-500 dark:text-red-400 mt-2"
        >
          {error.message}
        </div>
      )}
    </Form>
  );
};

InterviewForm.displayName = 'InterviewForm';

export default InterviewForm;