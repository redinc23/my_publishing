import { logger } from './secure-logger';
import EventEmitter from 'events';

// ===== ENHANCED CIRCUIT BREAKER WITH METRICS & OBSERVABILITY =====
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  halfOpenMaxRequests?: number;
  name?: string;
  fallback?: () => Promise<any>;
}

export interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  stateChanges: number;
  lastStateChange: Date;
  totalRequests: number;
  failedRequests: number;
  latency: {
    p50: number;
    p90: number;
    p99: number;
  };
}

export class EnhancedCircuitBreaker extends EventEmitter {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private halfOpenRequests = 0;
  private requestLatencies: number[] = [];
  private readonly metrics: CircuitBreakerMetrics;
  private readonly name: string;
  private readonly fallback?: () => Promise<any>;

  constructor(private config: CircuitBreakerConfig) {
    super();
    this.name = config.name || 'default';
    this.fallback = config.fallback;

    this.metrics = {
      failures: 0,
      successes: 0,
      stateChanges: 0,
      lastStateChange: new Date(),
      totalRequests: 0,
      failedRequests: 0,
      latency: { p50: 0, p90: 0, p99: 0 }
    };

    // Periodic metrics reporting
    setInterval(() => this.reportMetrics(), 60000).unref();
  }

  async execute<T>(fn: () => Promise<T>, context?: Record<string, any>): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.transitionToState('HALF_OPEN');
      } else {
        this.emit('circuitOpen', { name: this.name, context });
        logger.warn({ circuit: this.name, state: this.state, context }, 'Circuit breaker is OPEN');

        if (this.fallback) {
          return this.executeFallback(context);
        }

        throw new Error(`Circuit breaker "${this.name}" is OPEN`);
      }
    }

    // Check half-open limit
    if (this.state === 'HALF_OPEN' && this.halfOpenRequests >= (this.config.halfOpenMaxRequests || 1)) {
      this.emit('halfOpenLimitReached', { name: this.name, context });
      throw new Error(`Circuit breaker "${this.name}" half-open limit reached`);
    }

    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenRequests++;
      }

      const result = await Promise.race([
        fn(),
        this.createTimeoutPromise()
      ]);

      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      this.onSuccess();
      this.emit('success', { name: this.name, latency, context });

      return result;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      this.recordLatency(latency);

      this.onFailure(error);
      this.emit('failure', {
        name: this.name,
        error: error.message,
        latency,
        context
      });

      logger.error({
        circuit: this.name,
        error: error.message,
        state: this.state,
        failures: this.failures,
        context
      }, 'Circuit breaker execution failed');

      if (this.fallback) {
        return this.executeFallback(context);
      }

      throw error;
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Circuit breaker "${this.name}" timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  private async executeFallback(context?: Record<string, any>): Promise<any> {
    try {
      this.emit('fallbackExecuted', { name: this.name, context });
      logger.info({ circuit: this.name, context }, 'Executing fallback');

      if (this.fallback) {
        return await this.fallback();
      }

      throw new Error('No fallback provided');
    } catch (fallbackError: any) {
      this.emit('fallbackFailed', { name: this.name, error: fallbackError.message, context });
      throw new Error(`Fallback also failed: ${fallbackError.message}`);
    }
  }

  private onSuccess(): void {
    this.successes++;
    this.failures = 0;
    this.lastSuccessTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequests = 0;

      if (this.successes >= this.config.successThreshold) {
        this.transitionToState('CLOSED');
      }
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.metrics.failedRequests++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.transitionToState('OPEN');
      return;
    }

    if (this.failures >= this.config.failureThreshold) {
      this.transitionToState('OPEN');
    }
  }

  private transitionToState(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;
    this.metrics.stateChanges++;
    this.metrics.lastStateChange = new Date();

    this.emit('stateChanged', {
      name: this.name,
      oldState,
      newState,
      timestamp: new Date().toISOString(),
      metrics: { ...this.metrics }
    });

    logger.warn({
      circuit: this.name,
      oldState,
      newState,
      failures: this.failures,
      successes: this.successes
    }, `Circuit breaker state changed: ${oldState} -> ${newState}`);

    // Reset counters on state change
    if (newState === 'OPEN') {
      this.failures = 0;
      this.successes = 0;
    }
  }

  private recordLatency(latency: number): void {
    this.requestLatencies.push(latency);

    // Keep only last 1000 latencies
    if (this.requestLatencies.length > 1000) {
      this.requestLatencies.shift();
    }

    // Calculate percentiles
    if (this.requestLatencies.length >= 10) {
      const sorted = [...this.requestLatencies].sort((a, b) => a - b);
      this.metrics.latency.p50 = sorted[Math.floor(sorted.length * 0.5)];
      this.metrics.latency.p90 = sorted[Math.floor(sorted.length * 0.9)];
      this.metrics.latency.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }
  }

  private reportMetrics(): void {
    this.emit('metrics', {
      name: this.name,
      state: this.state,
      timestamp: new Date().toISOString(),
      metrics: { ...this.metrics }
    });

    logger.debug({
      circuit: this.name,
      state: this.state,
      metrics: this.metrics
    }, 'Circuit breaker metrics');
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.halfOpenRequests = 0;
    this.requestLatencies = [];
    this.transitionToState('CLOSED');

    logger.info({ circuit: this.name }, 'Circuit breaker manually reset');
  }

  // ===== STATIC REGISTRY FOR MULTIPLE CIRCUIT BREAKERS =====
  private static registry = new Map<string, EnhancedCircuitBreaker>();

  static getOrCreate(name: string, config: CircuitBreakerConfig): EnhancedCircuitBreaker {
    if (!this.registry.has(name)) {
      this.registry.set(name, new EnhancedCircuitBreaker({ ...config, name }));
    }
    return this.registry.get(name)!;
  }

  static get(name: string): EnhancedCircuitBreaker | undefined {
    return this.registry.get(name);
  }

  static getAll(): Map<string, EnhancedCircuitBreaker> {
    return new Map(this.registry);
  }

  static resetAll(): void {
    for (const [name, breaker] of this.registry) {
      breaker.reset();
    }
  }
}

// ===== DECORATOR FOR EASY USAGE =====
export function withCircuitBreaker(
  config: CircuitBreakerConfig
): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const circuitName = `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = async function (...args: any[]) {
      const breaker = EnhancedCircuitBreaker.getOrCreate(circuitName, {
        ...config,
        name: circuitName
      });

      return breaker.execute(() => originalMethod.apply(this, args), {
        args: args.length > 0 ? JSON.stringify(args).slice(0, 500) : 'none',
        className: target.constructor.name,
        methodName: String(propertyKey)
      });
    };

    return descriptor;
  };
}
