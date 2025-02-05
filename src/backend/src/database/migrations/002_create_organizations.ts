// @package knex version ^3.0.1
import { Knex } from 'knex';
import { OrganizationType, OrganizationStatus } from '../../types/organization.types';

// Table and enum type names
const TABLE_NAME = 'organizations';
const ORGANIZATION_TYPE_ENUM_NAME = 'organization_type';
const ORGANIZATION_STATUS_ENUM_NAME = 'organization_status';

// Helper function to create updated_at trigger
const createUpdatedAtTrigger = async (knex: Knex, tableName: string): Promise<void> => {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  await knex.raw(`
    CREATE TRIGGER update_${tableName}_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
};

export async function up(knex: Knex): Promise<void> {
  // Create organization_type enum
  await knex.raw(`
    CREATE TYPE ${ORGANIZATION_TYPE_ENUM_NAME} AS ENUM (
      '${OrganizationType.ENTERPRISE}',
      '${OrganizationType.BUSINESS}',
      '${OrganizationType.STARTUP}'
    );
  `);

  // Create organization_status enum
  await knex.raw(`
    CREATE TYPE ${ORGANIZATION_STATUS_ENUM_NAME} AS ENUM (
      '${OrganizationStatus.ACTIVE}',
      '${OrganizationStatus.INACTIVE}',
      '${OrganizationStatus.SUSPENDED}',
      '${OrganizationStatus.EXPIRED}'
    );
  `);

  // Create organizations table
  await knex.schema.createTable(TABLE_NAME, (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // Core fields
    table.string('name', 255).notNullable().unique()
      .index('idx_organizations_name');
    table.specificType('type', ORGANIZATION_TYPE_ENUM_NAME)
      .notNullable()
      .defaultTo(OrganizationType.BUSINESS);
    table.specificType('status', ORGANIZATION_STATUS_ENUM_NAME)
      .notNullable()
      .defaultTo(OrganizationStatus.ACTIVE)
      .index('idx_organizations_status');

    // Subscription fields
    table.string('subscription_tier').notNullable();
    table.timestamp('subscription_expires', { useTz: true })
      .notNullable()
      .index('idx_organizations_subscription_expires');

    // Settings and metadata
    table.jsonb('settings').notNullable().defaultTo('{}');

    // Timestamps
    table.timestamp('created_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    // Add check constraint for subscription expiration
    table.check(
      '?? > ??',
      ['subscription_expires', 'created_at'],
      'check_subscription_expires_after_creation'
    );
  });

  // Create GIN index for JSONB settings column
  await knex.raw(`
    CREATE INDEX idx_organizations_settings ON ${TABLE_NAME} USING GIN (settings jsonb_path_ops);
  `);

  // Create updated_at trigger
  await createUpdatedAtTrigger(knex, TABLE_NAME);
}

export async function down(knex: Knex): Promise<void> {
  // Drop table and related objects
  await knex.schema.dropTableIfExists(TABLE_NAME);

  // Drop custom enum types
  await knex.raw(`DROP TYPE IF EXISTS ${ORGANIZATION_TYPE_ENUM_NAME} CASCADE;`);
  await knex.raw(`DROP TYPE IF EXISTS ${ORGANIZATION_STATUS_ENUM_NAME} CASCADE;`);

  // Drop trigger function
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;');
}