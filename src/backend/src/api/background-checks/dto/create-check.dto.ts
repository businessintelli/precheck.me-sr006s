// @package zod version ^3.22.0
import { z } from 'zod';
import { BackgroundCheckType } from '../../../types/background-check.types';
import { validateUUID } from '../../../utils/validators';
import { DocumentType } from '../../../types/document.types';
import { DOCUMENT_UPLOAD_CONFIG } from '../../../utils/constants';

/**
 * Error messages for background check creation validation
 */
const ERROR_MESSAGES = {
  INVALID_CHECK_TYPE: 'Invalid background check type. Must be one of: BASIC, STANDARD, COMPREHENSIVE',
  INVALID_CANDIDATE_ID: 'Invalid candidate ID format',
  INVALID_ORGANIZATION_ID: 'Invalid organization ID format',
  INVALID_DOCUMENTS: 'Invalid document types provided',
  EMPTY_DOCUMENTS: 'At least one required document must be specified',
  INVALID_METADATA: 'Invalid metadata format',
  INVALID_URGENCY: 'Invalid urgency level. Must be one of: LOW, MEDIUM, HIGH',
  INVALID_DEPARTMENT: 'Department name must be between 2 and 100 characters',
  INVALID_POSITION: 'Position name must be between 2 and 100 characters',
  INVALID_NOTES: 'Notes cannot exceed 1000 characters'
} as const;

/**
 * Zod schema for background check metadata validation
 */
const backgroundCheckMetadataSchema = z.object({
  requestedBy: z.string().uuid(),
  department: z.string().min(2).max(100).optional(),
  position: z.string().min(2).max(100).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  notes: z.string().max(1000).optional(),
  customFields: z.record(z.unknown()).optional()
}).strict();

/**
 * Zod schema for creating new background checks with comprehensive validation
 */
export const CreateBackgroundCheckDto = z.object({
  type: z.nativeEnum(BackgroundCheckType, {
    errorMap: () => ({ message: ERROR_MESSAGES.INVALID_CHECK_TYPE })
  }),
  
  candidateId: z.string().uuid({
    message: ERROR_MESSAGES.INVALID_CANDIDATE_ID
  }).refine(
    (val) => validateUUID(val, 4),
    { message: ERROR_MESSAGES.INVALID_CANDIDATE_ID }
  ),
  
  organizationId: z.string().uuid({
    message: ERROR_MESSAGES.INVALID_ORGANIZATION_ID
  }).refine(
    (val) => validateUUID(val, 4),
    { message: ERROR_MESSAGES.INVALID_ORGANIZATION_ID }
  ),
  
  requiredDocuments: z.array(
    z.nativeEnum(DocumentType, {
      errorMap: () => ({ message: ERROR_MESSAGES.INVALID_DOCUMENTS })
    })
  ).min(1, ERROR_MESSAGES.EMPTY_DOCUMENTS)
  .refine(
    (docs) => {
      const checkType = z.get('type') as BackgroundCheckType;
      const requiredDocs = DOCUMENT_UPLOAD_CONFIG.REQUIRED_DOCUMENTS[checkType];
      return requiredDocs.every(doc => docs.includes(doc));
    },
    { message: 'Missing required documents for selected check type' }
  ),
  
  metadata: backgroundCheckMetadataSchema
}).strict();

/**
 * Type inference from the Zod schema for TypeScript usage
 */
export type CreateBackgroundCheckDtoType = z.infer<typeof CreateBackgroundCheckDto>;

/**
 * Validates and sanitizes background check creation request data
 * @param data - Raw input data to validate
 * @returns Promise resolving to validated and typed background check data
 */
export async function validateCreateBackgroundCheckDto(
  data: unknown
): Promise<CreateBackgroundCheckDtoType> {
  try {
    // Parse and validate the input data
    const validatedData = await CreateBackgroundCheckDto.parseAsync(data);

    // Ensure required documents match the check type
    const requiredDocs = DOCUMENT_UPLOAD_CONFIG.REQUIRED_DOCUMENTS[validatedData.type];
    const hasAllRequired = requiredDocs.every(doc => 
      validatedData.requiredDocuments.includes(doc)
    );

    if (!hasAllRequired) {
      throw new Error('Missing required documents for selected check type');
    }

    // Additional UUID validation for IDs
    if (!validateUUID(validatedData.candidateId) || 
        !validateUUID(validatedData.organizationId)) {
      throw new Error('Invalid UUID format');
    }

    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }
    throw error;
  }
}