import { logger } from './secure-logger';
import { EnhancedCircuitBreaker } from './circuit-breaker';

// ===== ADVANCED TIMEOUT WITH RETRY & BACKOFF =====
export interface TimeoutConfig {
  timeoutMs: number;
  retries?: number;
  backoff?: 'linear' | 'exponential' | 'fixed';
  backoffMs?: number;
  jitter?: boolean;
  onTimeout?: () => void;
  onRetry?: (attempt: number, error: Error) => void;
  fallback?: () => Promise<any>;
  circuitBreaker?: EnhancedCircuitBreaker;
}

export class TimeoutManager {
  private static instance: TimeoutManager;
  private activeTimeouts = new Map<string, NodeJS.Timeout>();
  private metrics = {
    totalTimeouts: 0,
    timedOutOperations: 0,
    successfulRetries: 0,
    failedRetries: 0
  };

  private constructor() {
    // Cleanup stale timeouts every minute
    setInterval(() => this.cleanupStaleTimeouts(), 60000).unref();
  }

  static getInstance(): TimeoutManager {
    if (!TimeoutManager.instance) {
      TimeoutManager.instance = new TimeoutManager();
    }
    return TimeoutManager.instance;
  }

  async withTimeout<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig | number,
    operationId?: string
  ): Promise<T> {
    const id = operationId || `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const normalizedConfig = typeof config === 'number'
      ? { timeoutMs: config }
      : config;

    const {
      timeoutMs,
      retries = 0,
      backoff = 'exponential',
      backoffMs = 1000,
      jitter = true,
      onTimeout,
      onRetry,
      fallback,
      circuitBreaker
    } = normalizedConfig;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Use circuit breaker if provided
        if (circuitBreaker) {
          return await circuitBreaker.execute(
            () => this.executeWithSingleTimeout(operation, timeoutMs, id, attempt),
            { operationId: id, attempt, timeoutMs }
          );
        } else {
          return await this.executeWithSingleTimeout(operation, timeoutMs, id, attempt);
        }
      } catch (error: any) {
        lastError = error;

        // Check if it's a timeout error
        if (error.message.includes('timeout') || error.message.includes('timed out')) {
          this.metrics.timedOutOperations++;

          if (onTimeout) {
            onTimeout();
          }
        }

        // If we have retries left, wait and retry
        if (attempt < retries) {
          const delay = this.calculateBackoff(attempt, backoff, backoffMs, jitter);

          logger.warn({
            operationId: id,
            attempt,
            totalAttempts: retries + 1,
            delay,
            error: error.message,
            timeoutMs
          }, 'Operation timed out, retrying...');

          if (onRetry) {
            onRetry(attempt, error);
          }

          await this.delay(delay);
          continue;
        }

        break;
      }
    }

    // All attempts failed, try fallback
    if (fallback) {
      try {
        logger.warn({ operationId: id }, 'All attempts failed, executing fallback');
        return await fallback();
      } catch (fallbackError: any) {
        throw new Error(
          `Operation failed after ${retries + 1} attempts and fallback also failed. ` +
          `Last error: ${lastError?.message}. ` +
          `Fallback error: ${fallbackError.message}`
        );
      }
    }

    throw new Error(
      `Operation failed after ${retries + 1} attempts. ` +
      `Last error: ${lastError?.message}`
    );
  }

  private async executeWithSingleTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationId: string,
    attempt: number
  ): Promise<T> {
    this.metrics.totalTimeouts++;

    return new Promise<T>((resolve, reject) => {
      let completed = false;

      // Create timeout
      const timeoutId = setTimeout(() => {
        if (!completed) {
          completed = true;
          this.activeTimeouts.delete(operationId);
          reject(new Error(`Operation "${operationId}" (attempt ${attempt}) timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Store timeout for potential cancellation
      this.activeTimeouts.set(operationId, timeoutId);

      // Execute operation
      operation()
        .then(result => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            this.activeTimeouts.delete(operationId);

            // Update metrics for successful retries
            if (attempt > 0) {
              this.metrics.successfulRetries++;
            }

            resolve(result);
          }
        })
        .catch(error => {
          if (!completed) {
            completed = true;
            clearTimeout(timeoutId);
            this.activeTimeouts.delete(operationId);

            // Update metrics for failed retries
            if (attempt > 0) {
              this.metrics.failedRetries++;
            }

            reject(error);
          }
        });
    });
  }

  private calculateBackoff(
    attempt: number,
    strategy: 'linear' | 'exponential' | 'fixed',
    baseMs: number,
    jitter: boolean
  ): number {
    let delay: number;

    switch (strategy) {
      case 'linear':
        delay = baseMs * (attempt + 1);
        break;
      case 'exponential':
        delay = baseMs * Math.pow(2, attempt);
        break;
      case 'fixed':
      default:
        delay = baseMs;
    }

    // Add jitter (±25%) to prevent thundering herd
    if (jitter) {
      const jitterAmount = delay * 0.25;
      delay += Math.random() * jitterAmount * 2 - jitterAmount;
    }

    return Math.max(100, Math.min(delay, 30000)); // Clamp between 100ms and 30s
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanupStaleTimeouts(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [id, timeout] of this.activeTimeouts.entries()) {
      // Check if timeout is unusually old (possible memory leak)
      const timeoutAge = now - parseInt(id.split('-')[1]);
      if (timeoutAge > staleThreshold) {
        clearTimeout(timeout);
        this.activeTimeouts.delete(id);
        logger.warn({ operationId: id, age: timeoutAge }, 'Cleaned up stale timeout');
      }
    }
  }

  cancelTimeout(operationId: string): boolean {
    const timeout = this.activeTimeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(operationId);
      logger.info({ operationId }, 'Timeout cancelled');
      return true;
    }
    return false;
  }

  getActiveTimeouts(): string[] {
    return Array.from(this.activeTimeouts.keys());
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// ===== CONVENIENCE FUNCTIONS =====
export const timeoutManager = TimeoutManager.getInstance();

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}

export async function withEnhancedTimeout<T>(
  promise: Promise<T> | (() => Promise<T>),
  config: TimeoutConfig | number,
  operationId?: string
): Promise<T> {
  const operation = typeof promise === 'function' ? promise : () => promise;
  return timeoutManager.withTimeout(operation, config, operationId);
}

// ===== BATCH TIMEOUT OPERATIONS =====
export async function withBatchTimeout<T>(
  operations: Array<() => Promise<T>>,
  config: TimeoutConfig | number,
  concurrency: number = 5
): Promise<Array<T | Error>> {
  const results: Array<T | Error> = [];
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const operationId = `batch-op-${i}-${Date.now()}`;

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }

    const promise = timeoutManager.withTimeout(operation, config, operationId)
      .then(result => {
        results[i] = result;
      })
      .catch(error => {
        results[i] = error;
      })
      .finally(() => {
        executing.delete(promise);
      });

    executing.add(promise);
  }

  // Wait for all remaining operations
  await Promise.all(executing);

  return results;
}

// ===== TYPE GUARDS AND UTILITIES =====
export function isTimeoutError(error: any): boolean {
  return error instanceof Error &&
    (error.message.includes('timeout') ||
     error.message.includes('timed out') ||
     error.name === 'TimeoutError');
}

export class TimeoutError extends Error {
  constructor(
    message: string,
    public readonly timeoutMs?: number,
    public readonly operationId?: string
  ) {
    super(message);
    this.name = 'TimeoutError';
  }
}
