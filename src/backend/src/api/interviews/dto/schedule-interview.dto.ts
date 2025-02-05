// @package zod version ^3.22.0
import { z } from 'zod';
import { InterviewType } from '../../types/interview.types';

/**
 * Constants for interview duration constraints in minutes
 */
export const MIN_INTERVIEW_DURATION = 30;
export const MAX_INTERVIEW_DURATION = 120;

/**
 * Zod schema for validating interview scheduling requests with comprehensive error handling
 */
export const scheduleInterviewSchema = z.object({
  type: z.nativeEnum(InterviewType, {
    required_error: 'Interview type is required',
    invalid_type_error: 'Invalid interview type',
  }),
  
  backgroundCheckId: z.string({
    required_error: 'Background check ID is required',
    invalid_type_error: 'Background check ID must be a string',
  }).uuid({
    message: 'Invalid background check ID format - must be a valid UUID',
  }),
  
  candidateId: z.string({
    required_error: 'Candidate ID is required',
    invalid_type_error: 'Candidate ID must be a string',
  }).uuid({
    message: 'Invalid candidate ID format - must be a valid UUID',
  }),
  
  scheduledAt: z.date({
    required_error: 'Interview schedule date is required',
    invalid_type_error: 'Invalid date format',
  }).refine(
    (date) => date > new Date(),
    {
      message: 'Interview must be scheduled for a future date',
    }
  ),
  
  duration: z.number({
    required_error: 'Interview duration is required',
    invalid_type_error: 'Duration must be a number',
  }).int({
    message: 'Duration must be a whole number',
  }).min(MIN_INTERVIEW_DURATION, {
    message: `Interview duration must be at least ${MIN_INTERVIEW_DURATION} minutes`,
  }).max(MAX_INTERVIEW_DURATION, {
    message: `Interview duration cannot exceed ${MAX_INTERVIEW_DURATION} minutes`,
  }),
}).strict({
  message: 'Additional properties are not allowed in interview scheduling request',
});

/**
 * Type definition for validated interview scheduling request
 */
export type ScheduleInterviewDto = z.infer<typeof scheduleInterviewSchema>;

/**
 * Validates and sanitizes interview scheduling request data
 * @param data - Raw interview scheduling request data
 * @returns Validated and transformed ScheduleInterviewDto
 * @throws ZodError with detailed validation error messages
 */
export const validateScheduleInterviewDto = (data: unknown): ScheduleInterviewDto => {
  try {
    // Parse and validate the input data against the schema
    const validatedData = scheduleInterviewSchema.parse(data);

    // Additional runtime checks for date validity
    if (isNaN(validatedData.scheduledAt.getTime())) {
      throw new Error('Invalid date format for scheduledAt');
    }

    // Return the validated and transformed data
    return validatedData;
  } catch (error) {
    // Re-throw zod validation errors with enhanced context
    if (error instanceof z.ZodError) {
      throw new z.ZodError(error.errors.map(err => ({
        ...err,
        message: `Interview scheduling validation failed: ${err.message}`
      })));
    }
    // Re-throw other errors with context
    throw new Error(`Interview scheduling validation failed: ${error.message}`);
  }
};