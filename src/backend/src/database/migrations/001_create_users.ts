// @package knex version ^3.0.1
import { Knex } from 'knex';
import { UserRole, UserStatus } from '../../types/user.types';

// Constants for table and enum names
const TABLE_NAME = 'users';
const USER_ROLE_ENUM_NAME = 'user_role';
const USER_STATUS_ENUM_NAME = 'user_status';

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const MIN_PASSWORD_HASH_LENGTH = 60;
const EMAIL_REGEX = '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';

/**
 * Creates the users table with comprehensive security features and optimized indexing
 */
export async function up(knex: Knex): Promise<void> {
  // Create enum types first
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE ${USER_ROLE_ENUM_NAME} AS ENUM (
        '${UserRole.SYSTEM_ADMIN}',
        '${UserRole.COMPANY_ADMIN}',
        '${UserRole.HR_MANAGER}',
        '${UserRole.CANDIDATE}'
      );
      
      CREATE TYPE ${USER_STATUS_ENUM_NAME} AS ENUM (
        '${UserStatus.ACTIVE}',
        '${UserStatus.INACTIVE}',
        '${UserStatus.SUSPENDED}',
        '${UserStatus.PENDING_VERIFICATION}'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create audit log function
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Create users table
  await knex.schema.createTable(TABLE_NAME, (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Core fields with constraints
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.specificType('role', USER_ROLE_ENUM_NAME).notNullable().defaultTo(UserRole.CANDIDATE);
    table.specificType('status', USER_STATUS_ENUM_NAME).notNullable().defaultTo(UserStatus.PENDING_VERIFICATION);
    
    // Organization relationship
    table.uuid('organization_id').references('id')
      .inTable('organizations')
      .onDelete('CASCADE')
      .notNullable();

    // Profile and security fields
    table.jsonb('profile').notNullable().defaultTo('{}');
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('password_changed_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_login').nullable();

    // Audit timestamps
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Indexes for performance optimization
    table.index(['organization_id', 'email'], 'idx_users_org_email');
    table.index('role', 'idx_users_role');
    table.index('status', 'idx_users_status');
  });

  // Add constraints
  await knex.raw(`
    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT chk_users_email_format 
    CHECK (email ~* '${EMAIL_REGEX}');

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT chk_users_password_hash_length 
    CHECK (length(password_hash) >= ${MIN_PASSWORD_HASH_LENGTH});

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT chk_users_failed_login_attempts 
    CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= ${MAX_LOGIN_ATTEMPTS});

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT chk_users_profile_format 
    CHECK (jsonb_typeof(profile) = 'object');
  `);

  // Create trigger for updated_at
  await knex.raw(`
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON ${TABLE_NAME}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // Create audit logging trigger
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS user_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES ${TABLE_NAME}(id),
      action varchar(50) NOT NULL,
      old_values jsonb,
      new_values jsonb,
      changed_by uuid,
      changed_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE OR REPLACE FUNCTION audit_users_changes()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO user_audit_log (user_id, action, old_values, new_values, changed_by)
      VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN row_to_json(NEW)::jsonb ELSE NULL END,
        current_setting('app.current_user_id', TRUE)::uuid
      );
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER users_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON ${TABLE_NAME}
    FOR EACH ROW EXECUTE FUNCTION audit_users_changes();
  `);
}

/**
 * Drops the users table and related objects in correct order
 */
export async function down(knex: Knex): Promise<void> {
  // Drop triggers first
  await knex.raw(`
    DROP TRIGGER IF EXISTS users_audit_trigger ON ${TABLE_NAME};
    DROP TRIGGER IF EXISTS update_users_updated_at ON ${TABLE_NAME};
  `);

  // Drop functions
  await knex.raw(`
    DROP FUNCTION IF EXISTS audit_users_changes();
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);

  // Drop audit log table
  await knex.raw(`DROP TABLE IF EXISTS user_audit_log`);

  // Drop main table
  await knex.schema.dropTableIfExists(TABLE_NAME);

  // Drop enum types
  await knex.raw(`
    DROP TYPE IF EXISTS ${USER_ROLE_ENUM_NAME};
    DROP TYPE IF EXISTS ${USER_STATUS_ENUM_NAME};
  `);
}