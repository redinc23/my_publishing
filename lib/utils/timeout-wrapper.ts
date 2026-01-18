export class TimeoutError extends Error {
  public readonly code = 'TIMEOUT';
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

export interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Optional timeout message */
  message?: string;
  /** Cleanup function to call if timeout occurs */
  onTimeout?: () => void | Promise<void>;
  /** Whether to abort if timeout occurs (requires fn supports AbortSignal) */
  abortSignal?: AbortSignal;
}

export interface TimeoutResult<T> {
  result: T;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

/**
 * Enhanced timeout wrapper with better error handling, cleanup, and diagnostics
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: number | TimeoutOptions
): Promise<T> {
  const opts = typeof options === 'number'
    ? { timeoutMs: options }
    : options;

  const { timeoutMs, message, onTimeout, abortSignal } = opts;
  const startTime = Date.now();

  // Create a promise that rejects after timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new TimeoutError(timeoutMs, message));
    }, timeoutMs);

    // Cleanup function
    const cleanup = () => clearTimeout(timer);

    // Optional abort signal support
    abortSignal?.addEventListener('abort', () => {
      cleanup();
      reject(new TimeoutError(timeoutMs, 'Operation aborted'));
    });
  });

  // Wrapped function with timing
  const operationPromise = (async () => {
    try {
      const result = await fn();
      const endTime = Date.now();

      // Return with timing information
      return {
        result,
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime
        }
      } as TimeoutResult<T>;
    } catch (error) {
      // Ensure timeout doesn't hide the original error
      if (error instanceof TimeoutError) throw error;

      // Re-throw with additional context
      const endTime = Date.now();
      const duration = endTime - startTime;

      const enhancedError = new Error(
        `Operation failed after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`
      );
      (enhancedError as any).cause = error;
      throw enhancedError;
    }
  })();

  try {
    // Race the operation against the timeout
    const raceResult = await Promise.race([operationPromise, timeoutPromise]);

    // If we get here, operation completed successfully
    return (raceResult as TimeoutResult<T>).result;
  } catch (error) {
    // Handle timeout
    if (error instanceof TimeoutError && onTimeout) {
      await Promise.resolve(onTimeout()).catch(() => {
        // Silently fail cleanup to avoid masking original error
      });
    }

    throw error;
  }
}

/**
 * Creates a reusable timeout wrapper for specific operations
 */
export function createTimeoutWrapper(defaultOptions: TimeoutOptions) {
  return {
    wrap<T>(fn: () => Promise<T>, overrideOptions?: Partial<TimeoutOptions>): Promise<T> {
      const options = { ...defaultOptions, ...overrideOptions };
      return withTimeout(fn, options);
    },

    withTimeout: <T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> => {
      return withTimeout(fn, { ...defaultOptions, timeoutMs });
    }
  };
}

/**
 * Batched operations with timeout per operation
 */
export async function withTimeoutPerOperation<T>(
  operations: Array<() => Promise<T>>,
  timeoutPerOperation: number,
  options?: {
    /** Continue on timeout? Default: false */
    continueOnTimeout?: boolean;
    /** Callback for timeout errors */
    onOperationTimeout?: (index: number, error: TimeoutError) => void;
  }
): Promise<Array<T | TimeoutError>> {
  const results: Array<T | TimeoutError> = [];

  await Promise.all(
    operations.map(async (operation, index) => {
      try {
        const result = await withTimeout(operation, timeoutPerOperation);
        results[index] = result;
      } catch (error) {
        if (error instanceof TimeoutError) {
          results[index] = error;
          options?.onOperationTimeout?.(index, error);

          if (!options?.continueOnTimeout) {
            throw error;
          }
        } else {
          throw error;
        }
      }
    })
  );

  return results;
}

/**
 * Exponential backoff with timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options: {
    timeoutMs: number;
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: Error) => boolean;
  }
): Promise<T> {
  const {
    timeoutMs,
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 30000,
    shouldRetry = (error: Error) => !(error instanceof TimeoutError)
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn, timeoutMs);
    } catch (error) {
      lastError = error as Error;

      // Don't retry if it's a timeout error (unless overridden) or no retries left
      if (!shouldRetry(lastError) || attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        maxDelay,
        baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Type guard for TimeoutError
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Utility to create timeout promises for testing
 */
export class TimeoutTestUtils {
  static createDelayedResolve<T>(value: T, delayMs: number): Promise<T> {
    return new Promise(resolve => setTimeout(() => resolve(value), delayMs));
  }

  static createDelayedReject(error: Error, delayMs: number): Promise<never> {
    return new Promise((_, reject) => setTimeout(() => reject(error), delayMs));
  }

  static simulateSlowOperation<T>(value: T, durationMs: number): Promise<T> {
    return new Promise(resolve => {
      setTimeout(() => resolve(value), durationMs);
    });
  }
}
