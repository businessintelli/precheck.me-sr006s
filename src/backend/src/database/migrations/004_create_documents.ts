// Knex v3.0.1 - SQL query builder for database migrations
import { Knex } from 'knex';

// Document types supported by the system
type DocumentType = 'GOVERNMENT_ID' | 'PROOF_OF_ADDRESS' | 'EMPLOYMENT_RECORD' | 'EDUCATION_CERTIFICATE';

// Verification status states for document processing
type VerificationStatus = 'PENDING' | 'PROCESSING' | 'VERIFIED' | 'REJECTED' | 'ERROR';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID generation if extension not already enabled
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create ENUM type for document types
  await knex.raw(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM (
          'GOVERNMENT_ID',
          'PROOF_OF_ADDRESS',
          'EMPLOYMENT_RECORD',
          'EDUCATION_CERTIFICATE'
        );
      END IF;
    END
    $$;
  `);

  // Create ENUM type for verification statuses
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM (
          'PENDING',
          'PROCESSING',
          'VERIFIED',
          'REJECTED',
          'ERROR'
        );
      END IF;
    END
    $$;
  `);

  // Create documents table with comprehensive schema
  await knex.schema.createTable('documents', (table) => {
    // Primary key using UUID v4
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Document classification
    table.specificType('document_type', 'document_type').notNullable();
    
    // Secure document URL with length limit and HTTPS requirement
    table.string('url', 2048).notNullable();
    table.specificType('status', 'verification_status')
      .notNullable()
      .defaultTo('PENDING');

    // Foreign key to background checks with cascade delete
    table.uuid('check_id')
      .notNullable()
      .references('id')
      .inTable('background_checks')
      .onDelete('CASCADE');

    // Verification metadata storage using JSONB
    table.jsonb('verification_result')
      .comment('Stores verification metadata including authenticity score, issues found, and verification details');

    // Timestamp tracking
    table.timestamp('uploaded_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('verified_at', { useTz: true });

    // URL format validation
    table.checkConstraint(
      "url ~ '^https?://.+'",
      'documents_url_format_check'
    );
  });

  // Create optimized indexes for common query patterns
  await knex.schema.raw(`
    CREATE INDEX idx_documents_check_id ON documents USING btree (check_id);
    CREATE INDEX idx_documents_status ON documents USING btree (status);
    CREATE INDEX idx_documents_type ON documents USING btree (document_type);
    CREATE INDEX idx_documents_verified ON documents USING btree (verified_at) 
    WHERE status = 'VERIFIED';
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop table and custom types in correct order
  await knex.schema.dropTableIfExists('documents');
  
  await knex.raw(`
    DROP TYPE IF EXISTS verification_status CASCADE;
    DROP TYPE IF EXISTS document_type CASCADE;
  `);
}