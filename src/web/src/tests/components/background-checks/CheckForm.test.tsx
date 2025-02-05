import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MockWebSocket, Server } from 'mock-socket';
import CheckForm from '../../../components/background-checks/CheckForm';
import { BackgroundCheckType } from '../../../types/background-check.types';
import { DocumentType } from '../../../types/document.types';
import { NotificationType } from '../../../types/notification.types';
import { PACKAGE_PRICING } from '../../../lib/constants';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../../hooks/useBackgroundCheck', () => ({
  useBackgroundCheck: () => ({
    createBackgroundCheck: jest.fn().mockResolvedValue({
      id: 'test-check-id',
      status: 'INITIATED'
    }),
    isLoading: false
  })
}));

jest.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    isConnected: true
  })
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn()
}));

// Test constants
const mockProps = {
  organizationId: 'test-org-id',
  onSuccess: jest.fn(),
  csrfToken: 'test-csrf-token'
};

const validFormData = {
  candidateName: 'John Doe',
  candidateEmail: 'john.doe@example.com',
  checkType: BackgroundCheckType.BASIC,
  documentIds: ['doc-id-1'],
  csrfToken: mockProps.csrfToken
};

describe('CheckForm Component', () => {
  let mockWebSocketServer: Server;

  beforeEach(() => {
    mockWebSocketServer = new Server('ws://localhost:1234');
    mockProps.onSuccess.mockClear();
  });

  afterEach(() => {
    mockWebSocketServer.close();
  });

  describe('Rendering and Layout', () => {
    it('renders all form sections correctly', () => {
      render(<CheckForm {...mockProps} />);

      // Check main sections
      expect(screen.getByText('New Background Check')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Candidate Full Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Candidate Email')).toBeInTheDocument();
      expect(screen.getByText('Select Check Type')).toBeInTheDocument();
      expect(screen.getByText('Required Documents')).toBeInTheDocument();
    });

    it('displays all package options with correct pricing', () => {
      render(<CheckForm {...mockProps} />);

      Object.entries(PACKAGE_PRICING).forEach(([type, details]) => {
        const packageElement = screen.getByText(type);
        const priceElement = screen.getByText(`$${details.price}`);
        
        expect(packageElement).toBeInTheDocument();
        expect(priceElement).toBeInTheDocument();
        
        // Verify features are displayed
        details.features.forEach(feature => {
          expect(screen.getByText(feature)).toBeInTheDocument();
        });
      });
    });

    it('shows required document upload sections based on selected package', async () => {
      render(<CheckForm {...mockProps} />);

      // Click COMPREHENSIVE package
      await userEvent.click(screen.getByText(BackgroundCheckType.COMPREHENSIVE));

      // Verify required document sections are displayed
      PACKAGE_PRICING[BackgroundCheckType.COMPREHENSIVE].requiredDocuments.forEach(docType => {
        expect(screen.getByText(docType)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      render(<CheckForm {...mockProps} />);
      
      // Submit empty form
      await userEvent.click(screen.getByText('Initiate Background Check'));

      // Check error messages
      expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
      expect(await screen.findByText('Invalid email format')).toBeInTheDocument();
      expect(await screen.findByText('At least one document is required')).toBeInTheDocument();
    });

    it('validates email format', async () => {
      render(<CheckForm {...mockProps} />);

      // Enter invalid email
      await userEvent.type(screen.getByPlaceholderText('Candidate Email'), 'invalid-email');
      await userEvent.click(screen.getByText('Initiate Background Check'));

      expect(await screen.findByText('Invalid email format')).toBeInTheDocument();
    });

    it('validates name format', async () => {
      render(<CheckForm {...mockProps} />);

      // Enter invalid name with numbers
      await userEvent.type(screen.getByPlaceholderText('Candidate Full Name'), 'John123');
      await userEvent.click(screen.getByText('Initiate Background Check'));

      expect(await screen.findByText('Name can only contain letters and spaces')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<CheckForm {...mockProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains proper focus management', async () => {
      render(<CheckForm {...mockProps} />);

      const nameInput = screen.getByPlaceholderText('Candidate Full Name');
      const emailInput = screen.getByPlaceholderText('Candidate Email');

      // Test keyboard navigation
      await userEvent.tab();
      expect(nameInput).toHaveFocus();

      await userEvent.tab();
      expect(emailInput).toHaveFocus();
    });

    it('provides proper ARIA attributes', () => {
      render(<CheckForm {...mockProps} />);

      // Check form inputs for proper ARIA attributes
      const nameInput = screen.getByPlaceholderText('Candidate Full Name');
      expect(nameInput).toHaveAttribute('aria-invalid', 'false');

      const emailInput = screen.getByPlaceholderText('Candidate Email');
      expect(emailInput).toHaveAttribute('aria-invalid', 'false');
    });
  });

  describe('Real-time Updates', () => {
    it('handles WebSocket status updates correctly', async () => {
      render(<CheckForm {...mockProps} />);

      // Simulate WebSocket message for document upload status
      mockWebSocketServer.emit('message', JSON.stringify({
        type: NotificationType.CHECK_STATUS_UPDATE,
        data: {
          status: 'DOCUMENTS_UPLOADED',
          checkId: 'test-check-id'
        }
      }));

      // Verify toast notification
      await waitFor(() => {
        expect(screen.getByText('Documents uploaded successfully')).toBeInTheDocument();
      });
    });

    it('maintains WebSocket connection during form interaction', async () => {
      const { rerender } = render(<CheckForm {...mockProps} />);

      // Simulate component updates
      rerender(<CheckForm {...mockProps} />);

      // Verify WebSocket subscriptions are maintained
      expect(mockWebSocketServer.clients().length).toBe(1);
    });
  });

  describe('Form Submission', () => {
    it('submits form with valid data successfully', async () => {
      render(<CheckForm {...mockProps} />);

      // Fill form with valid data
      await userEvent.type(screen.getByPlaceholderText('Candidate Full Name'), validFormData.candidateName);
      await userEvent.type(screen.getByPlaceholderText('Candidate Email'), validFormData.candidateEmail);
      
      // Select package type
      await userEvent.click(screen.getByText(BackgroundCheckType.BASIC));

      // Mock document upload
      const documentUpload = screen.getByText('Upload File');
      await userEvent.click(documentUpload);

      // Submit form
      await userEvent.click(screen.getByText('Initiate Background Check'));

      await waitFor(() => {
        expect(mockProps.onSuccess).toHaveBeenCalledWith('test-check-id');
      });
    });

    it('handles submission errors appropriately', async () => {
      const mockError = new Error('API Error');
      jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock failed submission
      jest.mock('../../../hooks/useBackgroundCheck', () => ({
        useBackgroundCheck: () => ({
          createBackgroundCheck: jest.fn().mockRejectedValue(mockError),
          isLoading: false
        })
      }));

      render(<CheckForm {...mockProps} />);

      // Submit form
      await userEvent.click(screen.getByText('Initiate Background Check'));

      await waitFor(() => {
        expect(screen.getByText('Failed to create background check')).toBeInTheDocument();
      });
    });
  });
});