import { secureLogger } from './secure-logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  timeout: number;
  name: string;
  halfOpenMaxCalls?: number;
  slidingWindowSize?: number;
}

export interface CircuitMetrics {
  successCount: number;
  failureCount: number;
  totalCalls: number;
  lastUpdated: number;
}

export interface CircuitEvent {
  circuitName: string;
  previousState: CircuitState;
  currentState: CircuitState;
  timestamp: number;
  reason?: string;
}

class CircuitBreaker<T = any> {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = [];
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  private metrics: CircuitMetrics = {
    successCount: 0,
    failureCount: 0,
    totalCalls: 0,
    lastUpdated: Date.now(),
  };

  constructor(private config: CircuitBreakerConfig) {
    secureLogger.debug(`Circuit breaker created: ${config.name}`, { config });
  }

  private transitionToState(newState: CircuitState, reason?: string): void {
    const previousState = this.state;

    if (previousState === newState) return;

    this.state = newState;

    if (newState === 'CLOSED') {
      this.failures = [];
      this.halfOpenCalls = 0;
    } else if (newState === 'HALF_OPEN') {
      this.halfOpenCalls = 0;
    }

    const event: CircuitEvent = {
      circuitName: this.config.name,
      previousState,
      currentState: newState,
      timestamp: Date.now(),
      reason,
    };

    secureLogger.info(`Circuit ${this.config.name} state changed`, event);
  }

  private shouldTrip(): boolean {
    const windowTime = this.config.resetTimeout || 60000;
    const now = Date.now();

    // Clean old failures
    this.failures = this.failures.filter(time => now - time < windowTime);

    return this.failures.length >= this.config.failureThreshold;
  }

  async call<U = T>(
    fn: () => Promise<U>,
    fallback?: () => Promise<U>
  ): Promise<U> {
    this.metrics.totalCalls++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.config.resetTimeout) {
        secureLogger.warn(`Circuit ${this.config.name} is OPEN, using fallback`);
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit ${this.config.name} is OPEN`);
      }
      this.transitionToState('HALF_OPEN', 'Reset timeout elapsed');
    }

    // Check half-open limits
    if (this.state === 'HALF_OPEN') {
      const maxHalfOpenCalls = this.config.halfOpenMaxCalls || 3;
      if (this.halfOpenCalls >= maxHalfOpenCalls) {
        if (fallback) {
          return fallback();
        }
        throw new Error(`Circuit ${this.config.name} HALF_OPEN call limit reached`);
      }
      this.halfOpenCalls++;
    }

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Circuit breaker timeout after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      // Race between operation and timeout
      const result = await Promise.race([fn(), timeoutPromise]);

      // Handle successful call
      this.metrics.successCount++;
      this.metrics.lastUpdated = Date.now();

      if (this.state === 'HALF_OPEN') {
        this.transitionToState('CLOSED', 'Success in half-open state');
      }

      return result;
    } catch (error) {
      // Handle failure
      this.metrics.failureCount++;
      this.metrics.lastUpdated = Date.now();
      this.failures.push(Date.now());
      this.lastFailureTime = Date.now();

      if (this.shouldTrip()) {
        this.transitionToState('OPEN', 'Failure threshold exceeded');
      }

      if (fallback) {
        secureLogger.info(`Circuit ${this.config.name} call failed, using fallback`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return fallback();
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.transitionToState('CLOSED', 'Manual reset');
    this.failures = [];
    this.halfOpenCalls = 0;
    this.metrics = {
      successCount: 0,
      failureCount: 0,
      totalCalls: 0,
      lastUpdated: Date.now(),
    };
  }
}

export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private circuits = new Map<string, CircuitBreaker>();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!CircuitBreakerManager.instance) {
      CircuitBreakerManager.instance = new CircuitBreakerManager();
    }
    return CircuitBreakerManager.instance;
  }

  getCircuit<T = any>(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker<T> {
    if (!this.circuits.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeout: 60000,
        timeout: 10000,
        name,
        halfOpenMaxCalls: 3,
        slidingWindowSize: 100,
      };

      const finalConfig = { ...defaultConfig, ...config, name };

      const circuit = new CircuitBreaker<T>(finalConfig);
      this.circuits.set(name, circuit);
      secureLogger.info(`Created new circuit breaker: ${name}`);
    }

    return this.circuits.get(name) as CircuitBreaker<T>;
  }

  getAllCircuits(): Map<string, CircuitBreaker> {
    return new Map(this.circuits);
  }

  getCircuitStats(name: string) {
    const circuit = this.circuits.get(name);
    if (!circuit) return null;

    const metrics = circuit.getMetrics();

    return {
      name,
      state: circuit.getState(),
      metrics: {
        ...metrics,
        successRate: metrics.totalCalls > 0 ? metrics.successCount / metrics.totalCalls : 1,
      },
    };
  }

  getAllCircuitStats() {
    const stats: Record<string, any> = {};
    for (const [name] of this.circuits) {
      stats[name] = this.getCircuitStats(name);
    }
    return stats;
  }

  resetCircuit(name: string): boolean {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.reset();
      return true;
    }
    return false;
  }

  destroyCircuit(name: string): boolean {
    return this.circuits.delete(name);
  }
}

export const circuitManager = CircuitBreakerManager.getInstance();
export default circuitManager;
