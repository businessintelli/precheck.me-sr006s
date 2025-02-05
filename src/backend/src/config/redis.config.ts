import { RedisOptions } from 'ioredis';
import { TLSSocket } from 'tls';
import { Logger } from '../utils/logger';

/**
 * Redis configuration error messages
 */
const REDIS_CONFIG_ERROR = 'Invalid Redis configuration provided';
const REDIS_CLUSTER_ERROR = 'Invalid cluster configuration provided';
const REDIS_SECURITY_ERROR = 'Invalid security configuration provided';

/**
 * Interface for Redis cluster node configuration
 */
interface RedisClusterNode {
  host: string;
  port: number;
  password?: string;
}

/**
 * Interface for Redis sentinel configuration
 */
interface RedisSentinelConfig {
  nodes: Array<{ host: string; port: number }>;
  masterName: string;
  password?: string;
  quorum: number;
}

/**
 * Interface for Redis connection pool settings
 */
interface RedisConnectionPool {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;
  idleTimeout: number;
}

/**
 * Interface for Redis monitoring configuration
 */
interface RedisMonitoring {
  enableMetrics: boolean;
  slowLogThreshold: number;
  commandTimeout: number;
  healthCheckInterval: number;
}

/**
 * Interface for Redis persistence configuration
 */
interface RedisPersistence {
  enableAOF: boolean;
  fsync: 'always' | 'everysec' | 'no';
  saveIntervals: Array<[number, number]>;
}

/**
 * Validates Redis configuration parameters
 * @param config Redis configuration object
 * @returns boolean indicating if configuration is valid
 */
export const validateRedisConfig = (config: typeof redisConfig): boolean => {
  try {
    // Validate basic connection parameters
    if (!config.host || !config.port) {
      Logger.error(REDIS_CONFIG_ERROR, { reason: 'Missing host or port' });
      return false;
    }

    // Validate TLS configuration if enabled
    if (config.tls.enabled && !config.tls.cert) {
      Logger.error(REDIS_SECURITY_ERROR, { reason: 'Missing TLS certificate' });
      return false;
    }

    // Validate cluster configuration if enabled
    if (config.clusterMode && !validateClusterConfig(config.cluster)) {
      return false;
    }

    // Validate sentinel configuration if enabled
    if (config.sentinel && (!config.sentinel.nodes.length || !config.sentinel.masterName)) {
      Logger.error(REDIS_CONFIG_ERROR, { reason: 'Invalid sentinel configuration' });
      return false;
    }

    // Validate connection pool settings
    if (config.connectionPool.maxConnections < config.connectionPool.minConnections) {
      Logger.error(REDIS_CONFIG_ERROR, { reason: 'Invalid connection pool limits' });
      return false;
    }

    return true;
  } catch (error) {
    Logger.error('Redis configuration validation failed', { error });
    return false;
  }
};

/**
 * Validates Redis cluster configuration
 * @param config Cluster configuration object
 * @returns boolean indicating if cluster configuration is valid
 */
export const validateClusterConfig = (config: typeof redisConfig.cluster): boolean => {
  try {
    if (!config.nodes || config.nodes.length < 3) {
      Logger.error(REDIS_CLUSTER_ERROR, { reason: 'Insufficient cluster nodes' });
      return false;
    }

    if (config.maxRedirections < 1) {
      Logger.error(REDIS_CLUSTER_ERROR, { reason: 'Invalid max redirections' });
      return false;
    }

    return true;
  } catch (error) {
    Logger.error('Cluster configuration validation failed', { error });
    return false;
  }
};

/**
 * Redis configuration object with comprehensive settings
 */
export const redisConfig = {
  // Basic connection settings
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),

  // High availability settings
  clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,

  // Cluster configuration
  cluster: {
    nodes: [
      { host: process.env.REDIS_CLUSTER_NODE1_HOST || 'localhost', port: 6379 },
      { host: process.env.REDIS_CLUSTER_NODE2_HOST || 'localhost', port: 6380 },
      { host: process.env.REDIS_CLUSTER_NODE3_HOST || 'localhost', port: 6381 }
    ],
    maxRedirections: 16,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 100,
    enableReadyCheck: true,
    scaleReads: 'slave'
  },

  // Sentinel configuration
  sentinel: {
    nodes: [
      { host: process.env.REDIS_SENTINEL1_HOST || 'localhost', port: 26379 },
      { host: process.env.REDIS_SENTINEL2_HOST || 'localhost', port: 26380 },
      { host: process.env.REDIS_SENTINEL3_HOST || 'localhost', port: 26381 }
    ],
    masterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
    password: process.env.REDIS_SENTINEL_PASSWORD,
    quorum: 2
  },

  // Security settings
  tls: {
    enabled: process.env.REDIS_TLS_ENABLED === 'true',
    cert: process.env.REDIS_TLS_CERT,
    key: process.env.REDIS_TLS_KEY,
    ca: process.env.REDIS_TLS_CA,
    rejectUnauthorized: true
  },

  // Connection pool settings
  connectionPool: {
    minConnections: parseInt(process.env.REDIS_POOL_MIN || '5', 10),
    maxConnections: parseInt(process.env.REDIS_POOL_MAX || '50', 10),
    acquireTimeout: 10000,
    idleTimeout: 30000
  },

  // Performance settings
  enableAutoPipelining: true,
  enableOfflineQueue: true,
  commandTimeout: 5000,
  keepAlive: 30000,
  connectTimeout: 10000,
  disconnectTimeout: 2000,
  
  // Monitoring configuration
  monitoring: {
    enableMetrics: true,
    slowLogThreshold: 100,
    commandTimeout: 5000,
    healthCheckInterval: 30000
  },

  // Persistence configuration
  persistence: {
    enableAOF: true,
    fsync: 'everysec' as const,
    saveIntervals: [
      [900, 1],   // Save after 900 seconds if at least 1 change
      [300, 10],  // Save after 300 seconds if at least 10 changes
      [60, 10000] // Save after 60 seconds if at least 10000 changes
    ]
  }
} as const;

/**
 * Generates Redis options for ioredis client
 * @returns RedisOptions configuration object
 */
export const getRedisOptions = (): RedisOptions => {
  const options: RedisOptions = {
    host: redisConfig.host,
    port: redisConfig.port,
    password: redisConfig.password,
    db: redisConfig.db,
    retryStrategy: redisConfig.retryStrategy,
    maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    enableAutoPipelining: redisConfig.enableAutoPipelining,
    enableOfflineQueue: redisConfig.enableOfflineQueue,
    commandTimeout: redisConfig.commandTimeout,
    keepAlive: redisConfig.keepAlive,
    connectTimeout: redisConfig.connectTimeout,
    disconnectTimeout: redisConfig.disconnectTimeout
  };

  // Add TLS configuration if enabled
  if (redisConfig.tls.enabled) {
    options.tls = {
      cert: redisConfig.tls.cert,
      key: redisConfig.tls.key,
      ca: redisConfig.tls.ca,
      rejectUnauthorized: redisConfig.tls.rejectUnauthorized
    };
  }

  // Add sentinel configuration if available
  if (redisConfig.sentinel.nodes.length > 0) {
    options.sentinels = redisConfig.sentinel.nodes;
    options.name = redisConfig.sentinel.masterName;
    options.sentinelPassword = redisConfig.sentinel.password;
  }

  return options;
};

export default redisConfig;