import { Redis, Cluster, RedisOptions } from 'ioredis'; // @version ^5.3.2
import { redisConfig } from '../../config/redis.config';
import { logger } from '../../utils/logger';
import { InternalServerError } from '../../utils/errors';

/**
 * Comprehensive Redis service implementation providing high-performance caching
 * capabilities with cluster support, automatic reconnection, and secure connection
 * management for the application's distributed caching layer.
 */
export class RedisService {
  private client: Redis | Cluster;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private healthCheckInterval?: NodeJS.Timer;
  private metrics: {
    operations: number;
    errors: number;
    latency: number[];
  } = {
    operations: 0,
    errors: 0,
    latency: []
  };

  constructor() {
    this.initializeClient();
    this.setupEventListeners();
    this.startHealthCheck();
  }

  /**
   * Initializes the Redis client based on configuration
   */
  private initializeClient(): void {
    try {
      if (redisConfig.clusterMode) {
        this.client = new Cluster(
          redisConfig.cluster.nodes,
          {
            redisOptions: this.getRedisOptions(),
            scaleReads: 'slave',
            maxRedirections: redisConfig.cluster.maxRedirections,
            retryDelayOnFailover: redisConfig.cluster.retryDelayOnFailover
          }
        );
      } else {
        this.client = new Redis(this.getRedisOptions());
      }
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error });
      throw new InternalServerError('Redis initialization failed');
    }
  }

  /**
   * Configures Redis client options with security and performance settings
   */
  private getRedisOptions(): RedisOptions {
    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      retryStrategy: (times: number) => {
        this.reconnectAttempts = times;
        if (times > 10) {
          logger.error('Max Redis reconnection attempts reached');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      enableAutoPipelining: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      keepAlive: 30000
    };

    if (redisConfig.tls.enabled) {
      options.tls = {
        cert: redisConfig.tls.cert,
        key: redisConfig.tls.key,
        ca: redisConfig.tls.ca,
        rejectUnauthorized: true
      };
    }

    return options;
  }

  /**
   * Sets up event listeners for connection monitoring
   */
  private setupEventListeners(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error });
      this.metrics.errors++;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Attempting to reconnect to Redis', {
        attempt: this.reconnectAttempts
      });
    });
  }

  /**
   * Starts periodic health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        logger.error('Redis health check failed', { error });
      }
    }, 30000);
  }

  /**
   * Performs comprehensive health check of Redis connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      this.metrics.latency.push(latency);
      if (this.metrics.latency.length > 100) {
        this.metrics.latency.shift();
      }

      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error });
      return false;
    }
  }

  /**
   * Sets a value in Redis with optional expiration
   */
  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const start = Date.now();
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }

      this.metrics.operations++;
      this.metrics.latency.push(Date.now() - start);
    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis set operation failed', { error, key });
      throw new InternalServerError('Cache operation failed');
    }
  }

  /**
   * Retrieves a value from Redis
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const start = Date.now();
      const value = await this.client.get(key);

      this.metrics.operations++;
      this.metrics.latency.push(Date.now() - start);

      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis get operation failed', { error, key });
      throw new InternalServerError('Cache retrieval failed');
    }
  }

  /**
   * Deletes a key from Redis
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const start = Date.now();
      const result = await this.client.del(key);

      this.metrics.operations++;
      this.metrics.latency.push(Date.now() - start);

      return result === 1;
    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis delete operation failed', { error, key });
      throw new InternalServerError('Cache deletion failed');
    }
  }

  /**
   * Flushes all keys from the current database
   */
  public async flush(): Promise<void> {
    try {
      const start = Date.now();
      await this.client.flushdb();

      this.metrics.operations++;
      this.metrics.latency.push(Date.now() - start);

      logger.info('Redis cache flushed successfully');
    } catch (error) {
      this.metrics.errors++;
      logger.error('Redis flush operation failed', { error });
      throw new InternalServerError('Cache flush failed');
    }
  }

  /**
   * Gracefully disconnects from Redis
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client disconnected successfully');
    } catch (error) {
      logger.error('Redis disconnect failed', { error });
      throw new InternalServerError('Cache disconnect failed');
    }
  }

  /**
   * Returns current cache metrics
   */
  public getMetrics() {
    const avgLatency = this.metrics.latency.length
      ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
      : 0;

    return {
      operations: this.metrics.operations,
      errors: this.metrics.errors,
      averageLatency: Math.round(avgLatency),
      connectionStatus: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}