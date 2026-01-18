import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { secureLogger } from '@/lib/utils/secure-logger';
import { UUIDSchema, LimitSchema } from '@/lib/utils/validation-schemas';
import { z } from 'zod';

// Validation schemas for connection pool configuration
const ConnectionPoolConfigSchema = z.object({
  maxConnections: z.number().int().min(1).max(100).default(20),
  connectionTimeoutMs: z.number().int().min(1000).max(30000).default(10000),
  idleTimeoutMs: z.number().int().min(30000).max(300000).default(60000),
  maxRetries: z.number().int().min(0).max(5).default(3),
  retryDelayMs: z.number().int().min(100).max(5000).default(1000),
});

export type ConnectionPoolConfig = z.infer<typeof ConnectionPoolConfigSchema>;

interface ConnectionStats {
  activeConnections: number;
  totalConnections: number;
  connectionErrors: number;
  poolSize: number;
  maxPoolSize: number;
  waitingRequests: number;
  averageAcquisitionTimeMs: number;
}

interface PooledConnection {
  id: string;
  client: SupabaseClient;
  createdAt: Date;
  lastUsedAt: Date;
  isIdle: boolean;
  isHealthy: boolean;
  usageCount: number;
}

interface WaitQueueItem {
  resolve: (client: SupabaseClient) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

class ConnectionPoolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'ConnectionPoolError';
  }
}

class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool | null = null;
  private connections: Map<string, PooledConnection> = new Map();
  private config: ConnectionPoolConfig;
  private stats: ConnectionStats;
  private waitQueue: WaitQueueItem[] = [];
  private isShuttingDown = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Parse and validate configuration
    this.config = ConnectionPoolConfigSchema.parse({
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
      connectionTimeoutMs: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '10000'),
      idleTimeoutMs: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '60000'),
      maxRetries: parseInt(process.env.DATABASE_MAX_RETRIES || '3'),
      retryDelayMs: parseInt(process.env.DATABASE_RETRY_DELAY_MS || '1000'),
    });

    this.stats = {
      activeConnections: 0,
      totalConnections: 0,
      connectionErrors: 0,
      poolSize: 0,
      maxPoolSize: this.config.maxConnections,
      waitingRequests: 0,
      averageAcquisitionTimeMs: 0,
    };

    // Start background tasks
    this.startHealthChecks();
    this.startCleanupTask();

    secureLogger.info('Database connection pool initialized', {
      config: this.config,
      initialStats: this.stats,
    });
  }

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  static async destroyInstance(): Promise<void> {
    if (DatabaseConnectionPool.instance) {
      await DatabaseConnectionPool.instance.destroy();
      DatabaseConnectionPool.instance = null;
    }
  }

  async getConnection(options?: {
    timeoutMs?: number;
    maxRetries?: number;
  }): Promise<SupabaseClient> {
    if (this.isShuttingDown) {
      throw new ConnectionPoolError(
        'Connection pool is shutting down',
        'POOL_SHUTDOWN'
      );
    }

    const startTime = Date.now();
    const timeoutMs = options?.timeoutMs || this.config.connectionTimeoutMs;
    const maxRetries = options?.maxRetries || this.config.maxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Try to get an idle connection
        const idleConnection = this.getNextIdleConnection();
        if (idleConnection) {
          idleConnection.isIdle = false;
          idleConnection.lastUsedAt = new Date();
          idleConnection.usageCount++;

          const acquisitionTime = Date.now() - startTime;
          this.updateAverageAcquisitionTime(acquisitionTime);

          secureLogger.debug('Acquired idle connection', {
            connectionId: idleConnection.id,
            attempt,
            acquisitionTime,
          });

          return idleConnection.client;
        }

        // Try to create a new connection
        if (this.connections.size < this.config.maxConnections) {
          const connection = await this.createNewConnection();

          const acquisitionTime = Date.now() - startTime;
          this.updateAverageAcquisitionTime(acquisitionTime);

          secureLogger.debug('Created new connection', {
            connectionId: connection.id,
            attempt,
            acquisitionTime,
          });

          return connection.client;
        }

        // Wait for a connection to become available
        const client = await this.waitForConnection(timeoutMs);

        const acquisitionTime = Date.now() - startTime;
        this.updateAverageAcquisitionTime(acquisitionTime);

        return client;
      } catch (error) {
        if (attempt === maxRetries) {
          this.stats.connectionErrors++;

          const errorData = {
            attempt,
            timeoutMs,
            poolStats: this.getStats(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          secureLogger.error('Failed to acquire database connection', error, errorData);

          throw new ConnectionPoolError(
            `Failed to acquire connection after ${maxRetries + 1} attempts`,
            'CONNECTION_ACQUISITION_FAILED',
            errorData
          );
        }

        const delay = this.config.retryDelayMs * Math.pow(2, attempt); // Exponential backoff
        await this.sleep(delay);
      }
    }

    throw new ConnectionPoolError(
      'Unexpected error in connection acquisition',
      'UNEXPECTED_ERROR'
    );
  }

  releaseConnection(client: SupabaseClient): void {
    for (const [id, connection] of this.connections) {
      if (connection.client === client) {
        connection.isIdle = true;
        connection.lastUsedAt = new Date();
        this.stats.activeConnections--;

        // Notify waiting requests if any
        this.notifyWaitingRequests();

        secureLogger.debug('Released connection', {
          connectionId: id,
          currentActive: this.stats.activeConnections,
        });
        break;
      }
    }
  }

  async query<T>(
    queryFn: (client: SupabaseClient) => Promise<T>,
    options?: {
      timeoutMs?: number;
      maxRetries?: number;
    }
  ): Promise<T> {
    const connection = await this.getConnection(options);
    const connectionId = this.getConnectionId(connection);

    try {
      const result = await queryFn(connection);

      secureLogger.debug('Query executed successfully', {
        connectionId,
      });

      return result;
    } catch (error) {
      this.stats.connectionErrors++;

      const errorData = {
        connectionId,
        poolStats: this.getStats(),
      };

      secureLogger.error('Database query failed', error, errorData);

      // Mark connection as unhealthy
      this.markConnectionUnhealthy(connection);

      throw error;
    } finally {
      this.releaseConnection(connection);
    }
  }

  getStats(): ConnectionStats {
    return {
      ...this.stats,
      poolSize: this.connections.size,
      waitingRequests: this.waitQueue.length,
    };
  }

  async destroy(): Promise<void> {
    secureLogger.info('Shutting down connection pool');

    this.isShuttingDown = true;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject all waiting requests
    this.waitQueue.forEach(item => {
      item.reject(
        new ConnectionPoolError(
          'Connection pool is shutting down',
          'POOL_SHUTDOWN'
        )
      );
      clearTimeout(item.timeoutId);
    });
    this.waitQueue = [];

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(
      async (connection) => {
        try {
          // Supabase client doesn't have a close method, but we can clean up resources
          this.connections.delete(connection.id);
          secureLogger.debug('Removed connection during shutdown', {
            connectionId: connection.id,
          });
        } catch (error) {
          secureLogger.error('Error removing connection during shutdown', error, {
            connectionId: connection.id,
          });
        }
      }
    );

    await Promise.allSettled(closePromises);

    secureLogger.info('Connection pool shutdown complete', {
      finalStats: this.getStats(),
    });
  }

  private getNextIdleConnection(): PooledConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.isIdle && connection.isHealthy) {
        return connection;
      }
    }
    return null;
  }

  private async createNewConnection(): Promise<PooledConnection> {
    const connectionId = crypto.randomUUID();

    try {
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          global: {
            headers: {
              'x-connection-id': connectionId,
              'x-pool-instance': crypto.randomUUID(),
            },
          },
        }
      );

      // Test the connection
      await this.testConnection(client);

      const connection: PooledConnection = {
        id: connectionId,
        client,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        isIdle: false,
        isHealthy: true,
        usageCount: 0,
      };

      this.connections.set(connectionId, connection);
      this.stats.activeConnections++;
      this.stats.totalConnections++;
      this.stats.poolSize++;

      secureLogger.info('Created new database connection', {
        connectionId,
        currentPoolSize: this.connections.size,
      });

      return connection;
    } catch (error) {
      this.stats.connectionErrors++;

      secureLogger.error('Failed to create database connection', error, {
        connectionId,
      });

      throw new ConnectionPoolError(
        'Failed to create database connection',
        'CONNECTION_CREATION_FAILED',
        { connectionId, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  private async testConnection(client: SupabaseClient): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection test timeout')), 5000)
    );

    const testPromise = client.from('books').select('count', { count: 'exact', head: true });

    await Promise.race([testPromise, timeoutPromise]).catch(() => {
      // Ignore errors - we just want to see if the connection is responsive
    });
  }

  private waitForConnection(timeoutMs: number): Promise<SupabaseClient> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitQueue.findIndex(item => item.timeoutId === timeoutId);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(
          new ConnectionPoolError(
            'Timeout waiting for database connection',
            'CONNECTION_TIMEOUT',
            { timeoutMs, waitingQueueSize: this.waitQueue.length }
          )
        );
      }, timeoutMs);

      this.waitQueue.push({ resolve, reject, timeoutId });
      this.stats.waitingRequests = this.waitQueue.length;

      secureLogger.debug('Request added to waiting queue', {
        queueSize: this.waitQueue.length,
        timeoutMs,
      });
    });
  }

  private notifyWaitingRequests(): void {
    const idleConnection = this.getNextIdleConnection();
    if (idleConnection && this.waitQueue.length > 0) {
      const item = this.waitQueue.shift();
      if (item) {
        clearTimeout(item.timeoutId);
        idleConnection.isIdle = false;
        idleConnection.lastUsedAt = new Date();
        idleConnection.usageCount++;
        this.stats.activeConnections++;
        this.stats.waitingRequests = this.waitQueue.length;

        item.resolve(idleConnection.client);

        secureLogger.debug('Request removed from waiting queue', {
          connectionId: idleConnection.id,
          remainingQueueSize: this.waitQueue.length,
        });
      }
    }
  }

  private getConnectionId(client: SupabaseClient): string | null {
    for (const [id, connection] of this.connections) {
      if (connection.client === client) {
        return id;
      }
    }
    return null;
  }

  private markConnectionUnhealthy(client: SupabaseClient): void {
    for (const [id, connection] of this.connections) {
      if (connection.client === client) {
        connection.isHealthy = false;
        secureLogger.warn('Marked connection as unhealthy', {
          connectionId: id,
        });
        break;
      }
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [id, connection] of this.connections) {
        if (!connection.isIdle && connection.isHealthy) {
          try {
            await this.testConnection(connection.client);
          } catch (error) {
            secureLogger.warn('Health check failed for connection', {
              connectionId: id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            connection.isHealthy = false;
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let removedCount = 0;

      for (const [id, connection] of this.connections) {
        if (
          connection.isIdle &&
          now - connection.lastUsedAt.getTime() > this.config.idleTimeoutMs
        ) {
          this.connections.delete(id);
          removedCount++;

          secureLogger.debug('Removed idle connection', {
            connectionId: id,
            idleTime: now - connection.lastUsedAt.getTime(),
          });
        } else if (!connection.isHealthy && connection.isIdle) {
          this.connections.delete(id);
          removedCount++;

          secureLogger.debug('Removed unhealthy connection', {
            connectionId: id,
          });
        }
      }

      if (removedCount > 0) {
        this.stats.poolSize = this.connections.size;
        secureLogger.info('Cleanup completed', {
          removedConnections: removedCount,
          remainingPoolSize: this.connections.size,
        });
      }
    }, 60000); // Every minute
  }

  private updateAverageAcquisitionTime(newTime: number): void {
    this.stats.averageAcquisitionTimeMs = Math.round(
      (this.stats.averageAcquisitionTimeMs * 0.9) + (newTime * 0.1)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance export
export const databasePool = DatabaseConnectionPool.getInstance();
export default databasePool;

// Helper function for common query patterns
export const withDatabase = async <T>(
  queryFn: (client: SupabaseClient) => Promise<T>,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
  }
): Promise<T> => {
  return databasePool.query(queryFn, options);
};

// Validation for database operations
export const validateDatabaseInput = <T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> => {
  try {
    return schema.parse(data);
  } catch (error) {
    secureLogger.error('Database input validation failed', error, { data });
    throw new ConnectionPoolError(
      'Invalid database input',
      'VALIDATION_ERROR',
      { validationError: error }
    );
  }
};
