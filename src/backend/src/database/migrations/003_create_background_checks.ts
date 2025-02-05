// @package knex version ^2.5.1
import { Knex } from 'knex';
import { BackgroundCheckType, BackgroundCheckStatus } from '../../types/background-check.types';

/**
 * Migration to create the background_checks table with comprehensive fields,
 * foreign key relationships, indices, and support for verification results storage
 */
export async function up(knex: Knex): Promise<void> {
    // Create enum types first
    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE background_check_type AS ENUM (
                '${BackgroundCheckType.BASIC}',
                '${BackgroundCheckType.STANDARD}',
                '${BackgroundCheckType.COMPREHENSIVE}'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);

    await knex.raw(`
        DO $$ BEGIN
            CREATE TYPE background_check_status AS ENUM (
                '${BackgroundCheckStatus.INITIATED}',
                '${BackgroundCheckStatus.IN_PROGRESS}',
                '${BackgroundCheckStatus.COMPLETED}',
                '${BackgroundCheckStatus.FAILED}'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `);

    // Create the background_checks table
    await knex.schema.createTable('background_checks', (table) => {
        // Primary key
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

        // Core fields
        table.specificType('type', 'background_check_type').notNullable();
        table.specificType('status', 'background_check_status').notNullable().defaultTo(BackgroundCheckStatus.INITIATED);
        
        // Foreign key relationships
        table.uuid('candidate_id').notNullable()
            .references('id').inTable('users')
            .onDelete('CASCADE');
            
        table.uuid('organization_id').notNullable()
            .references('id').inTable('organizations')
            .onDelete('RESTRICT');
            
        table.uuid('requested_by').notNullable()
            .references('id').inTable('users')
            .onDelete('RESTRICT');

        // Verification results and metadata
        table.jsonb('verification_results').notNullable().defaultTo('{}');
        table.timestamp('last_verified_at').nullable();
        table.timestamp('verification_expiry').nullable();
        
        // Priority and reference fields
        table.smallint('priority').notNullable().defaultTo(0);
        table.string('external_reference_id', 100).nullable();

        // Timestamps
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        // Indices for performance optimization
        table.index(['organization_id', 'created_at']);
        table.index(['candidate_id', 'status']);
        table.index(['type', 'status']);

        // Check constraints
        table.check('?? >= 0 AND ?? <= 100', ['priority']);
    });

    // Create trigger for updating updated_at timestamp
    await knex.raw(`
        CREATE TRIGGER update_background_checks_updated_at
            BEFORE UPDATE ON background_checks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    `);
}

/**
 * Rollback migration to drop the background_checks table and related objects
 */
export async function down(knex: Knex): Promise<void> {
    // Drop the table
    await knex.schema.dropTableIfExists('background_checks');

    // Drop the enum types
    await knex.raw(`
        DROP TYPE IF EXISTS background_check_type;
        DROP TYPE IF EXISTS background_check_status;
    `);
}