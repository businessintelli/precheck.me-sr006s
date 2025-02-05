import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // ^14.0.0
import { z } from 'zod'; // ^3.22.0
import { toast } from 'react-hot-toast'; // ^2.4.1
import { Form } from '../shared/Form';
import { DocumentUpload } from '../documents/DocumentUpload';
import { useBackgroundCheck } from '../../hooks/useBackgroundCheck';
import { useWebSocket } from '../../hooks/useWebSocket';
import { BackgroundCheckType, BackgroundCheckStatus } from '../../types/background-check.types';
import { DocumentType } from '../../types/document.types';
import { PACKAGE_PRICING } from '../../lib/constants';

// Form validation schema
const checkFormSchema = z.object({
  candidateName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(/^[a-zA-Z\s]*$/, 'Name can only contain letters and spaces'),
  candidateEmail: z
    .string()
    .email('Invalid email format')
    .toLowerCase(),
  checkType: z.nativeEnum(BackgroundCheckType, {
    errorMap: () => ({ message: 'Please select a valid check type' })
  }),
  documentIds: z
    .array(z.string().uuid())
    .min(1, 'At least one document is required')
    .max(10, 'Maximum 10 documents allowed'),
  csrfToken: z.string().nonempty('CSRF token is required')
});

type CheckFormValues = z.infer<typeof checkFormSchema>;

interface CheckFormProps {
  organizationId: string;
  onSuccess?: (checkId: string) => void;
  csrfToken: string;
}

const CheckForm: React.FC<CheckFormProps> = ({
  organizationId,
  onSuccess,
  csrfToken
}) => {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<BackgroundCheckType>(BackgroundCheckType.BASIC);
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  
  const { createBackgroundCheck, isLoading } = useBackgroundCheck();
  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  // Handle real-time status updates
  const handleStatusUpdate = useCallback((data: any) => {
    if (data.status === BackgroundCheckStatus.DOCUMENTS_UPLOADED) {
      toast.success('Documents uploaded successfully');
    }
  }, []);

  // Subscribe to WebSocket updates
  React.useEffect(() => {
    subscribe('CHECK_STATUS_UPDATE', handleStatusUpdate);
    return () => unsubscribe('CHECK_STATUS_UPDATE', handleStatusUpdate);
  }, [subscribe, unsubscribe, handleStatusUpdate]);

  // Handle document upload completion
  const handleDocumentUpload = useCallback((documentId: string) => {
    setUploadedDocuments(prev => [...prev, documentId]);
  }, []);

  // Handle form submission
  const handleSubmit = async (data: CheckFormValues) => {
    try {
      const check = await createBackgroundCheck({
        type: data.checkType,
        candidateId: data.candidateEmail, // Email used as temporary candidate ID
        organizationId,
        documentIds: data.documentIds
      });

      toast.success('Background check initiated successfully');
      onSuccess?.(check.id);
      router.push(`/background-checks/${check.id}`);
    } catch (error) {
      toast.error('Failed to create background check');
      console.error('Form submission error:', error);
    }
  };

  // Get required documents based on check type
  const requiredDocuments = PACKAGE_PRICING[selectedType].requiredDocuments;

  return (
    <Form
      schema={checkFormSchema}
      onSubmit={handleSubmit}
      defaultValues={{
        checkType: BackgroundCheckType.BASIC,
        documentIds: [],
        csrfToken
      }}
      className="space-y-6"
    >
      {({ formState: { errors } }) => (
        <>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              New Background Check
            </h2>

            {/* Candidate Information */}
            <div className="space-y-4">
              <input
                type="text"
                name="candidateName"
                placeholder="Candidate Full Name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                aria-invalid={!!errors.candidateName}
                aria-describedby={errors.candidateName ? "name-error" : undefined}
              />
              {errors.candidateName && (
                <p id="name-error" className="text-sm text-red-600">
                  {errors.candidateName.message}
                </p>
              )}

              <input
                type="email"
                name="candidateEmail"
                placeholder="Candidate Email"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                aria-invalid={!!errors.candidateEmail}
                aria-describedby={errors.candidateEmail ? "email-error" : undefined}
              />
              {errors.candidateEmail && (
                <p id="email-error" className="text-sm text-red-600">
                  {errors.candidateEmail.message}
                </p>
              )}
            </div>

            {/* Check Type Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Select Check Type
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(PACKAGE_PRICING).map(([type, details]) => (
                  <div
                    key={type}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedType === type
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-200'
                    }`}
                    onClick={() => setSelectedType(type as BackgroundCheckType)}
                  >
                    <h4 className="font-medium">{type}</h4>
                    <p className="text-2xl font-bold">${details.price}</p>
                    <ul className="mt-2 text-sm text-gray-600">
                      {details.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="text-green-500">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Required Documents
              </h3>
              {requiredDocuments.map((documentType) => (
                <div key={documentType} className="p-4 border rounded-lg">
                  <h4 className="mb-2 font-medium">{documentType}</h4>
                  <DocumentUpload
                    checkId={organizationId}
                    documentType={documentType}
                    onUploadComplete={handleDocumentUpload}
                    onUploadError={(error) => toast.error(error.message)}
                  />
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full px-6 py-3 text-white bg-primary-600 rounded-lg
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-700'}
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
            >
              {isLoading ? 'Processing...' : 'Initiate Background Check'}
            </button>
          </div>

          {/* Hidden CSRF Token */}
          <input type="hidden" name="csrfToken" value={csrfToken} />
        </>
      )}
    </Form>
  );
};

export default CheckForm;