"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { DashboardShell } from '../../../components/layout/DashboardShell';
import DocumentList from '../../../components/documents/DocumentList';
import DocumentUpload from '../../../components/documents/DocumentUpload';
import { useDocument } from '../../../hooks/useDocument';
import { useAuth } from '../../../hooks/useAuth';
import { Document, DocumentType } from '../../../types/document.types';
import { cn } from '../../../lib/utils';

/**
 * Secure document management dashboard with real-time updates and role-based access
 */
const DocumentsPage: React.FC = () => {
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Custom hooks
  const { user, checkDocumentAccess } = useAuth();
  const { 
    document: documentState,
    uploadDocument,
    subscribeToUpdates,
    sortDocuments
  } = useDocument('');

  // Responsive layout
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');

  /**
   * Fetch initial documents with access control
   */
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const hasAccess = await checkDocumentAccess();
      if (!hasAccess) {
        throw new Error('Unauthorized access to documents');
      }

      // Fetch documents based on user role and permissions
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [checkDocumentAccess]);

  /**
   * Handle secure document upload with encryption
   */
  const handleUpload = useCallback(async (file: File, type: DocumentType) => {
    try {
      const uploadedDocument = await uploadDocument(file, type, {
        onProgress: (progress) => {
          console.log('Upload progress:', progress);
        },
        onError: (error) => {
          console.error('Upload error:', error);
        }
      });

      setDocuments(prev => [...prev, uploadedDocument]);
      setShowUploadModal(false);
    } catch (error) {
      console.error('Document upload failed:', error);
    }
  }, [uploadDocument]);

  /**
   * Handle document sorting with access validation
   */
  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    const sorted = sortDocuments(documents, column, direction);
    setDocuments(sorted);
  }, [documents, sortDocuments]);

  /**
   * Set up real-time document updates
   */
  useEffect(() => {
    const unsubscribe = documents.map(doc => 
      subscribeToUpdates(doc.id, (updatedDoc) => {
        setDocuments(prev => 
          prev.map(d => d.id === updatedDoc.id ? updatedDoc : d)
        );
      })
    );

    return () => {
      unsubscribe.forEach(unsub => unsub());
    };
  }, [documents, subscribeToUpdates]);

  // Initial data fetch
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <DashboardShell>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col space-y-6">
          {/* Header section */}
          <div className={cn(
            "flex items-center justify-between",
            "border-b border-gray-200 pb-4"
          )}>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Documents
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage and track your verification documents
              </p>
            </div>

            {/* Upload button - shown based on permissions */}
            {user?.role !== 'CANDIDATE' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className={cn(
                  "px-4 py-2 bg-primary text-white rounded-md",
                  "hover:bg-primary/90 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
                aria-label="Upload new document"
              >
                Upload Document
              </button>
            )}
          </div>

          {/* Main content area */}
          <div className={cn(
            "grid gap-6",
            isMobile ? "grid-cols-1" : 
            isTablet ? "grid-cols-2" : 
            "grid-cols-3"
          )}>
            {/* Document list with real-time updates */}
            <DocumentList
              documents={documents}
              isLoading={isLoading}
              onSort={handleSort}
              onDocumentSelect={setSelectedDocument}
              accessLevel={user?.role === 'ADMIN' ? 'admin' : 'read'}
              showVerificationDetails={true}
              className="col-span-full"
            />
          </div>
        </div>

        {/* Upload modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
              <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
              <DocumentUpload
                checkId={selectedDocument?.checkId || ''}
                documentType={DocumentType.GOVERNMENT_ID}
                onUploadComplete={(doc) => {
                  setDocuments(prev => [...prev, doc]);
                  setShowUploadModal(false);
                }}
                onUploadError={(error) => {
                  console.error('Upload failed:', error);
                  setShowUploadModal(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
};

export default DocumentsPage;