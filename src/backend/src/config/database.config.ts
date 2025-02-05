import { z } from 'zod'; // @version ^3.22.0
import { Pool } from 'pg'; // @version ^8.11.0
import { StatsD } from 'hot-shots'; // @version ^9.2.0
import { validateDTO } from '../utils/validators';
import { Logger } from '../utils/logger';

// Global constants for database configuration
const DEFAULT_POOL_SIZE = 20;
const DEFAULT_IDLE_TIMEOUT = 10000;
const DEFAULT_CONNECTION_TIMEOUT = 5000;
const MAX_POOL_SIZE = 100;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

// Initialize StatsD client for metrics
const statsd = new StatsD({
  prefix: 'database.',
  globalTags: { service: 'precheck-api' }
});

// Database configuration schema with comprehensive validation
const databaseConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string(),
  ssl: z.boolean().default(false),
  max: z.number().int().min(1).max(MAX_POOL_SIZE).default(DEFAULT_POOL_SIZE),
  idleTimeoutMillis: z.number().int().positive().default(DEFAULT_IDLE_TIMEOUT),
  connectionTimeoutMillis: z.number().int().positive().default(DEFAULT_CONNECTION_TIMEOUT),
  readReplicas: z.array(z.object({
    host: z.string().min(1),
    port: z.number().int().positive(),
    weight: z.number().int().min(1).max(100).default(1)
  })).default([]),
  failoverStrategy: z.object({
    enabled: z.boolean().default(true),
    maxAttempts: z.number().int().positive().default(RETRY_ATTEMPTS),
    retryDelay: z.number().int().positive().default(RETRY_DELAY)
  }).default({})
});

/**
 * Validates database configuration based on environment
 */
async function validateDatabaseConfig(config: unknown, environment: string): Promise<z.infer<typeof databaseConfigSchema>> {
  const validationOptions = {
    context: { environment }
  };

  // Add environment-specific validation rules
  if (environment === 'production') {
    databaseConfigSchema.extend({
      ssl: z.literal(true),
      max: z.number().int().min(5)
    });
  }

  return await validateDTO(databaseConfigSchema, config, validationOptions);
}

/**
 * Creates and configures PostgreSQL connection pool with advanced features
 */
async function createConnectionPool(config: z.infer<typeof databaseConfigSchema>): Promise<Pool> {
  const logger = new Logger();
  let primaryPool: Pool | null = null;
  const replicaPools: Pool[] = [];

  try {
    // Create primary connection pool
    primaryPool = new Pool({
      ...config,
      application_name: 'precheck-api',
      statement_timeout: 30000,
      query_timeout: 30000
    });

    // Initialize read replicas if configured
    if (config.readReplicas.length > 0) {
      for (const replica of config.readReplicas) {
        const replicaPool = new Pool({
          ...config,
          host: replica.host,
          port: replica.port,
          application_name: 'precheck-api-replica'
        });
        replicaPools.push(replicaPool);
      }
    }

    // Set up connection monitoring
    primaryPool.on('connect', () => {
      statsd.increment('connections.created');
      logger.info('New database connection established');
    });

    primaryPool.on('error', (err) => {
      statsd.increment('connections.error');
      logger.error(err, { context: 'Database connection error' });
    });

    primaryPool.on('remove', () => {
      statsd.increment('connections.removed');
      logger.info('Database connection removed from pool');
    });

    // Add health check method
    const healthCheck = async () => {
      try {
        const client = await primaryPool.connect();
        const result = await client.query('SELECT 1');
        client.release();
        return result.rows[0] !== undefined;
      } catch (error) {
        logger.error(error, { context: 'Database health check failed' });
        return false;
      }
    };

    // Extend pool with custom methods
    const enhancedPool = Object.assign(primaryPool, {
      getHealth: healthCheck,
      getMetrics: () => ({
        totalCount: primaryPool.totalCount,
        idleCount: primaryPool.idleCount,
        waitingCount: primaryPool.waitingCount
      })
    });

    return enhancedPool;
  } catch (error) {
    logger.error(error, { context: 'Failed to create database pool' });
    throw error;
  }
}

// Export database configuration
export const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'precheck',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production',
  max: parseInt(process.env.DB_POOL_SIZE || String(DEFAULT_POOL_SIZE), 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || String(DEFAULT_IDLE_TIMEOUT), 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || String(DEFAULT_CONNECTION_TIMEOUT), 10),
  readReplicas: process.env.DB_READ_REPLICAS ? JSON.parse(process.env.DB_READ_REPLICAS) : [],
  failoverStrategy: {
    enabled: true,
    maxAttempts: RETRY_ATTEMPTS,
    retryDelay: RETRY_DELAY
  }
};

// Create and export database pool instance
export const pool = await createConnectionPool(
  await validateDatabaseConfig(databaseConfig, process.env.NODE_ENV || 'development')
);