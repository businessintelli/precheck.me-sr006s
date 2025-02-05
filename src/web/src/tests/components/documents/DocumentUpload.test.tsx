import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import DocumentUpload from '../../../components/documents/DocumentUpload';
import { DocumentType } from '../../../types/document.types';

// Mock useDocument hook
vi.mock('../../../hooks/useDocument', () => ({
  useDocument: () => ({
    uploadDocument: vi.fn(),
    cancelUpload: vi.fn(),
    validateDocument: vi.fn(),
    encryptDocument: vi.fn(),
    isUploading: false,
    uploadProgress: 0,
    uploadSpeed: 0,
    timeRemaining: 0
  })
}));

// Test files setup
const mockFiles = {
  validPdf: new File(['test'], 'test.pdf', { type: 'application/pdf' }),
  validImage: new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
  invalidType: new File(['test'], 'test.exe', { type: 'application/x-msdownload' }),
  largeFile: new File([new ArrayBuffer(51 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' }),
  maliciousFile: new File(['test'], '<script>alert("xss")</script>.pdf', { type: 'application/pdf' })
};

// Test document types
const mockDocuments = {
  governmentId: { id: '123', type: DocumentType.GOVERNMENT_ID, status: 'PENDING' },
  proofOfAddress: { id: '456', type: DocumentType.PROOF_OF_ADDRESS, status: 'PENDING' }
};

describe('DocumentUpload Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    it('renders with proper ARIA attributes and roles', () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
        />
      );

      const dropzone = screen.getByRole('button');
      expect(dropzone).toHaveAttribute('aria-label', 'File upload input');
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
        />
      );

      const dropzone = screen.getByRole('button');
      await user.tab();
      expect(dropzone).toHaveFocus();
    });

    it('displays proper file type restrictions', () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          acceptedFileTypes={['.pdf', '.jpg', '.jpeg']}
        />
      );

      expect(screen.getByText(/supported formats/i)).toHaveTextContent(/pdf, jpg, jpeg/i);
    });
  });

  describe('File Upload Functionality', () => {
    it('handles drag and drop of valid files', async () => {
      const onUploadComplete = vi.fn();
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          onUploadComplete={onUploadComplete}
        />
      );

      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.validPdf]
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/test.pdf/i)).toBeInTheDocument();
      });
    });

    it('validates file size restrictions', async () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          maxSize={50 * 1024 * 1024}
        />
      );

      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.largeFile]
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/file size exceeds maximum/i);
      });
    });

    it('shows upload progress with cancel option', async () => {
      const { rerender } = render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
        />
      );

      // Simulate upload in progress
      rerender(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          isUploading={true}
          uploadProgress={50}
        />
      );

      expect(screen.getByText('50% complete')).toBeInTheDocument();
      expect(screen.getByText(/cancel upload/i)).toBeInTheDocument();
    });
  });

  describe('Validation and Security', () => {
    it('prevents upload of disallowed file types', async () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
        />
      );

      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.invalidType]
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/file type not allowed/i);
      });
    });

    it('sanitizes file names for security', async () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
        />
      );

      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.maliciousFile]
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid characters/i);
      });
    });
  });

  describe('Error Handling', () => {
    it('displays network error messages', async () => {
      const onUploadError = vi.fn();
      const { rerender } = render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          onUploadError={onUploadError}
        />
      );

      // Simulate network error
      rerender(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          error={{ message: 'Network error occurred' }}
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent(/network error occurred/i);
    });

    it('handles quota exceeded errors', async () => {
      const onUploadError = vi.fn();
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          onUploadError={onUploadError}
        />
      );

      // Simulate quota exceeded
      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.validPdf]
        }
      });

      // Mock storage quota error
      onUploadError.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await waitFor(() => {
        expect(onUploadError).toHaveBeenCalled();
      });
    });
  });

  describe('Compression and Preview', () => {
    it('shows preview for image files', async () => {
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
        />
      );

      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.validImage]
        }
      });

      await waitFor(() => {
        const preview = screen.getByAltText('File preview');
        expect(preview).toBeInTheDocument();
      });
    });

    it('compresses images before upload', async () => {
      const onUploadComplete = vi.fn();
      render(
        <DocumentUpload
          checkId="test-check"
          documentType={DocumentType.GOVERNMENT_ID}
          onUploadComplete={onUploadComplete}
          compressionOptions={{
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
          }}
        />
      );

      const dropzone = screen.getByRole('button');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFiles.validImage]
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/compressing file/i)).toBeInTheDocument();
      });
    });
  });
});