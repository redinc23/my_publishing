interface TraceConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  slowThreshold: number; // ms
  captureArgs?: boolean;
  captureResult?: boolean;
  maxArgLength?: number;
}

interface TraceMetadata {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: any;
  args?: any[];
  result?: any;
  context?: Record<string, any>;
}

interface TracingOptions {
  name?: string;
  captureArgs?: boolean;
  captureResult?: boolean;
  context?: Record<string, any>;
}

class TracingManager {
  private static instance: TracingManager;
  private config: TraceConfig;
  private traces: Map<string, TraceMetadata[]> = new Map();
  private enabled: boolean = true;

  private constructor() {
    this.config = {
      enabled: process.env.NODE_ENV !== 'production',
      logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      slowThreshold: 1000,
      captureArgs: true,
      captureResult: false,
      maxArgLength: 200,
    };
  }

  static getInstance(): TracingManager {
    if (!TracingManager.instance) {
      TracingManager.instance = new TracingManager();
    }
    return TracingManager.instance;
  }

  configure(config: Partial<TraceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isEnabled(): boolean {
    return this.enabled && this.config.enabled;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.config.logLevel);
    const targetLevel = levels.indexOf(level);
    return targetLevel >= currentLevel;
  }

  private formatData(data: any): any {
    if (!this.config.captureArgs) return '[REDACTED]';

    if (typeof data === 'object') {
      const str = JSON.stringify(data);
      return this.config.maxArgLength && str.length > this.config.maxArgLength
        ? str.substring(0, this.config.maxArgLength) + '...'
        : str;
    }
    return data;
  }

  async trace<T>(
    name: string,
    operation: () => Promise<T>,
    options: TracingOptions = {}
  ): Promise<T> {
    if (!this.isEnabled()) {
      return operation();
    }

    const startTime = performance.now();
    const metadata: TraceMetadata = {
      name,
      startTime,
      args: options.captureArgs ? this.formatData(arguments) : undefined,
      context: options.context,
    };

    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;

      metadata.endTime = endTime;
      metadata.duration = duration;
      metadata.success = true;
      metadata.result = options.captureResult ? this.formatData(result) : undefined;

      this.logTrace(metadata);

      if (duration > this.config.slowThreshold) {
        this.logSlowTrace(metadata);
      }

      this.storeTrace(name, metadata);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      metadata.endTime = endTime;
      metadata.duration = duration;
      metadata.success = false;
      metadata.error = error;

      this.logErrorTrace(metadata);
      this.storeTrace(name, metadata);
      throw error;
    }
  }

  private logTrace(metadata: TraceMetadata): void {
    if (!this.shouldLog('info')) return;

    const message = `[TRACE] ${metadata.name} ${metadata.success ? '✅' : '❌'} ${
      metadata.duration!.toFixed(2)
    }ms`;

    if (metadata.success) {
      console.info(message);
    } else {
      console.error(message, metadata.error);
    }

    if (this.shouldLog('debug')) {
      if (metadata.args) console.debug('  Args:', metadata.args);
      if (metadata.result) console.debug('  Result:', metadata.result);
      if (metadata.context) console.debug('  Context:', metadata.context);
    }
  }

  private logSlowTrace(metadata: TraceMetadata): void {
    if (!this.shouldLog('warn')) return;

    console.warn(
      `[SLOW_TRACE] ${metadata.name} took ${metadata.duration!.toFixed(2)}ms ` +
      `(threshold: ${this.config.slowThreshold}ms)`
    );
  }

  private logErrorTrace(metadata: TraceMetadata): void {
    if (!this.shouldLog('error')) return;

    console.error(
      `[TRACE_ERROR] ${metadata.name} failed after ${metadata.duration!.toFixed(2)}ms`,
      metadata.error
    );
  }

  private storeTrace(name: string, metadata: TraceMetadata): void {
    if (!this.traces.has(name)) {
      this.traces.set(name, []);
    }
    this.traces.get(name)!.push(metadata);

    // Keep only last 100 traces per name to prevent memory leaks
    if (this.traces.get(name)!.length > 100) {
      this.traces.get(name)!.shift();
    }
  }

  getTraces(name?: string): TraceMetadata[] {
    if (name) {
      return this.traces.get(name) || [];
    }
    return Array.from(this.traces.values()).flat();
  }

  clearTraces(name?: string): void {
    if (name) {
      this.traces.delete(name);
    } else {
      this.traces.clear();
    }
  }
}

// Singleton instance
export const tracer = TracingManager.getInstance();

// Decorator factory with enhanced options
export function traceFunction(
  name?: string,
  options: Omit<TracingOptions, 'name'> = {}
): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const methodName = name || String(propertyKey);
    const original = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const finalOptions: TracingOptions = {
        name: methodName,
        captureArgs: options.captureArgs,
        captureResult: options.captureResult,
        context: {
          className: target.constructor.name,
          methodName: String(propertyKey),
          instanceId: (this as any).id || (this as any)._id || (this as any).name || 'unknown',
          ...options.context,
        },
      };

      return tracer.trace(
        methodName,
        () => original.apply(this, args),
        finalOptions
      );
    };

    return descriptor;
  };
}

// Manual tracing utility
export function trace<T>(
  name: string,
  operation: () => Promise<T>,
  options?: TracingOptions
): Promise<T> {
  return tracer.trace(name, operation, options);
}

// Sync operation wrapper
export function traceSync<T>(
  name: string,
  operation: () => T,
  options?: TracingOptions
): T {
  if (!tracer.isEnabled()) {
    return operation();
  }

  const startTime = performance.now();
  const metadata: TraceMetadata = {
    name,
    startTime,
    args: options?.captureArgs ? [arguments] : undefined,
    context: options?.context,
  };

  try {
    const result = operation();
    const endTime = performance.now();
    metadata.endTime = endTime;
    metadata.duration = endTime - startTime;
    metadata.success = true;
    metadata.result = options?.captureResult ? result : undefined;

    (tracer as any).logTrace(metadata);
    return result;
  } catch (error) {
    const endTime = performance.now();
    metadata.endTime = endTime;
    metadata.duration = endTime - startTime;
    metadata.success = false;
    metadata.error = error;

    (tracer as any).logErrorTrace(metadata);
    throw error;
  }
}

// Initialization with environment awareness
export function initTracing(config?: Partial<TraceConfig>): void {
  const tracingInstance = TracingManager.getInstance();

  if (config) {
    tracingInstance.configure(config);
  }

  if (tracingInstance.isEnabled()) {
    console.log('✅ Tracing initialized', {
      logLevel: (tracingInstance as any).config.logLevel,
      slowThreshold: (tracingInstance as any).config.slowThreshold,
      environment: process.env.NODE_ENV,
    });
  }
}

// Performance metrics helper
export function withMetrics<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> & { metrics: Promise<{ duration: number }> } {
  const startTime = performance.now();
  const operationPromise = operation();

  const metricsPromise = operationPromise.then(
    () => ({
      duration: performance.now() - startTime,
    }),
    () => ({
      duration: performance.now() - startTime,
    })
  );

  const result = operationPromise as Promise<T> & { metrics: Promise<{ duration: number }> };
  result.metrics = metricsPromise;

  return result;
}
