// @package knex version ^2.5.1
import { Knex } from 'knex';
import { InterviewStatus, InterviewType } from '../../types/interview.types';

/**
 * Migration to create the interviews table and related database objects
 * for managing AI-powered interview sessions
 */
export async function up(knex: Knex): Promise<void> {
  // Create custom enum types first
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE interview_type AS ENUM (
        '${InterviewType.TECHNICAL}',
        '${InterviewType.BEHAVIORAL}',
        '${InterviewType.MANAGEMENT}'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE interview_status AS ENUM (
        '${InterviewStatus.SCHEDULED}',
        '${InterviewStatus.IN_PROGRESS}',
        '${InterviewStatus.COMPLETED}',
        '${InterviewStatus.CANCELLED}',
        '${InterviewStatus.FAILED}'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create the interviews table
  await knex.schema.createTable('interviews', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Core fields
    table.specificType('type', 'interview_type').notNullable();
    table.specificType('status', 'interview_status')
      .notNullable()
      .defaultTo(InterviewStatus.SCHEDULED);
    
    // Foreign key relationships
    table.uuid('background_check_id')
      .notNullable()
      .references('id')
      .inTable('background_checks')
      .onDelete('CASCADE');
    
    table.uuid('candidate_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // Interview scheduling and duration
    table.timestamp('scheduled_at', { useTz: true }).notNullable();
    table.integer('duration').notNullable().checkPositive();

    // Interview content and AI analysis
    table.jsonb('questions').notNullable().defaultTo('[]');
    table.jsonb('responses').notNullable().defaultTo('[]');
    table.jsonb('analysis').notNullable().defaultTo('{}');

    // Metadata and timestamps
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Create indices for efficient querying
  await knex.schema.raw(`
    CREATE INDEX idx_interviews_background_check_id ON interviews (background_check_id);
    CREATE INDEX idx_interviews_candidate_id ON interviews (candidate_id);
    CREATE INDEX idx_interviews_status ON interviews (status);
    CREATE INDEX idx_interviews_scheduled_at ON interviews (scheduled_at);
    CREATE INDEX idx_interviews_type ON interviews (type);
    CREATE INDEX idx_interviews_candidate_status_scheduled 
      ON interviews (candidate_id, status, scheduled_at);
  `);

  // Create updated_at trigger function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_interviews_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Create trigger for automatic updated_at updates
  await knex.raw(`
    CREATE TRIGGER update_interviews_updated_at_trigger
      BEFORE UPDATE ON interviews
      FOR EACH ROW
      EXECUTE FUNCTION update_interviews_updated_at();
  `);
}

/**
 * Rollback migration to remove the interviews table and related objects
 */
export async function down(knex: Knex): Promise<void> {
  // Drop indices first
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_interviews_background_check_id;
    DROP INDEX IF EXISTS idx_interviews_candidate_id;
    DROP INDEX IF EXISTS idx_interviews_status;
    DROP INDEX IF EXISTS idx_interviews_scheduled_at;
    DROP INDEX IF EXISTS idx_interviews_type;
    DROP INDEX IF EXISTS idx_interviews_candidate_status_scheduled;
  `);

  // Drop trigger and function
  await knex.raw(`
    DROP TRIGGER IF EXISTS update_interviews_updated_at_trigger ON interviews;
    DROP FUNCTION IF EXISTS update_interviews_updated_at();
  `);

  // Drop the interviews table
  await knex.schema.dropTableIfExists('interviews');

  // Drop custom enum types
  await knex.raw(`
    DROP TYPE IF EXISTS interview_type CASCADE;
    DROP TYPE IF EXISTS interview_status CASCADE;
  `);
}