import crypto from 'crypto';
import os from 'os';
import { EventEmitter } from 'events';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export enum LogCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  AUDIT = 'audit',
  BUSINESS = 'business',
  TECHNICAL = 'technical',
  DATABASE = 'database',
  NETWORK = 'network',
  AUTH = 'authentication',
  SYSTEM = 'system'
}

export interface LogContext {
  requestId?: string;
  sessionId?: string;
  userId?: string;
  correlationId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  context?: LogContext;
  hostname: string;
  pid: number;
  environment: string;
  version?: string;
  service: string;
  traceId?: string;
  spanId?: string;
  duration?: number;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  serviceName: string;
  version?: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  redactionSalt: string;
  maxStringLength: number;
  enablePerformanceMetrics: boolean;
  samplingRate: number;
  sensitiveKeys: string[];
  customPatterns: RegExp[];
  transportConfig?: TransportConfig;
}

export interface TransportConfig {
  filePath?: string;
  remoteEndpoint?: string;
  remoteAuthToken?: string;
  batchSize?: number;
  flushInterval?: number;
  maxQueueSize?: number;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  tags?: Record<string, any>;
}

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: LogLevel.INFO,
  serviceName: process.env.SERVICE_NAME || 'unknown-service',
  version: process.env.APP_VERSION,
  enableConsole: process.env.NODE_ENV !== 'test',
  enableFile: process.env.NODE_ENV === 'production',
  enableRemote: false,
  redactionSalt: process.env.LOGGING_SALT || crypto.randomBytes(32).toString('hex'),
  maxStringLength: 10000,
  enablePerformanceMetrics: true,
  samplingRate: 1.0,
  sensitiveKeys: [
    'password', 'secret', 'token', 'key', 'apiKey', 'auth', 'credential',
    'bearer', 'jwt', 'accessToken', 'refreshToken', 'privateKey', 'certificate',
    'ssn', 'socialSecurity', 'creditCard', 'cvv', 'pin', 'dob', 'phone', 'email'
  ],
  customPatterns: []
};

const SENSITIVE_PATTERNS: RegExp[] = [
  // API Keys (various formats)
  /sk-(live|test)_[a-zA-Z0-9]{48}/,
  /pk-(live|test)_[a-zA-Z0-9]{48}/,
  /[0-9a-f]{64}/,
  /[0-9a-f]{32}/,

  // JWTs
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,

  // Emails
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,

  // IP Addresses
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,

  // Credit Cards
  /\b(?:\d[ -]*?){13,16}\b/,

  // Social Security Numbers
  /\b\d{3}-\d{2}-\d{4}\b/,

  // Phone Numbers (US & International)
  /\b(?:\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/,

  // AWS Keys
  /AKIA[0-9A-Z]{16}/,
  /ASIA[0-9A-Z]{16}/
];

const REDACTED = '🔴[REDACTED]';
const TRUNCATED_SUFFIX = '...✂️[TRUNCATED]';

class SecureLogger extends EventEmitter {
  private config: LoggerConfig;
  private salt: Buffer;
  private performanceMetrics: Map<string, PerformanceMetric[]> = new Map();
  private logQueue: LogEntry[] = [];
  private isFlushing: boolean = false;
  private flushTimer?: NodeJS.Timeout;
  private requestContextStore = new Map<string, LogContext>();

  constructor(config?: Partial<LoggerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.salt = Buffer.from(this.config.redactionSalt, 'hex');

    // Combine patterns
    SENSITIVE_PATTERNS.push(...this.config.customPatterns);

    this.initializeTransports();
    this.setupGracefulShutdown();
  }

  // === Configuration Management ===
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  // === Context Management ===
  setRequestContext(requestId: string, context: LogContext): void {
    this.requestContextStore.set(requestId, context);
  }

  getRequestContext(requestId: string): LogContext | undefined {
    return this.requestContextStore.get(requestId);
  }

  clearRequestContext(requestId: string): void {
    this.requestContextStore.delete(requestId);
  }

  createContext(context: Partial<LogContext> = {}): LogContext {
    const defaultContext: LogContext = {
      requestId: crypto.randomBytes(8).toString('hex'),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    return { ...defaultContext, ...context };
  }

  // === Core Logging Methods ===
  error(message: string, error?: any, data?: any, context?: LogContext): void {
    this.log(LogLevel.ERROR, LogCategory.TECHNICAL, message, data, error, context);
  }

  warn(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.WARN, LogCategory.TECHNICAL, message, data, undefined, context);
  }

  info(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.INFO, LogCategory.BUSINESS, message, data, undefined, context);
  }

  debug(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.DEBUG, LogCategory.TECHNICAL, message, data, undefined, context);
  }

  trace(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.TRACE, LogCategory.TECHNICAL, message, data, undefined, context);
  }

  security(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.INFO, LogCategory.SECURITY, message, data, undefined, context);
  }

  audit(message: string, data?: any, context?: LogContext): void {
    this.log(LogLevel.INFO, LogCategory.AUDIT, message, data, undefined, context);
  }

  // === Performance Monitoring ===
  startTimer(operation: string, tags?: Record<string, any>): () => number {
    const start = process.hrtime.bigint();

    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

      this.recordMetric(operation, duration, tags);

      if (duration > 1000) { // Log slow operations (>1s)
        this.warn(`Slow operation detected: ${operation}`, { duration, tags });
      }

      return duration;
    };
  }

  private recordMetric(operation: string, duration: number, tags?: Record<string, any>): void {
    if (!this.config.enablePerformanceMetrics) return;

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: Date.now(),
      tags: this.sanitize(tags)
    };

    const metrics = this.performanceMetrics.get(operation) || [];
    metrics.push(metric);

    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.performanceMetrics.set(operation, metrics);
  }

  getMetrics(operation?: string): PerformanceMetric[] | Map<string, PerformanceMetric[]> {
    if (operation) {
      return this.performanceMetrics.get(operation) || [];
    }
    return new Map(this.performanceMetrics);
  }

  // === HTTP Request Logging ===
  logHttpRequest(req: any, res: any, context?: LogContext): void {
    const requestId = context?.requestId || crypto.randomBytes(8).toString('hex');
    const requestContext: LogContext = {
      requestId,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
      method: req.method,
      url: req.url,
      ...context
    };

    this.setRequestContext(requestId, requestContext);

    const startTime = Date.now();
    const originalEnd = res.end;
    const originalWrite = res.write;
    const logger = this; // Save reference to this

    let responseBody = '';

    res.write = function(chunk: any, ...args: any[]): boolean {
      if (chunk instanceof Buffer) {
        responseBody += chunk.toString();
      } else if (typeof chunk === 'string') {
        responseBody += chunk;
      }
      return originalWrite.apply(res, [chunk, ...args]);
    };

    res.end = function(chunk?: any, ...args: any[]): any {
      if (chunk) {
        if (chunk instanceof Buffer) {
          responseBody += chunk.toString();
        } else if (typeof chunk === 'string') {
          responseBody += chunk;
        }
      }

      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 500 ? LogLevel.ERROR :
                      res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

      const logData = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        requestHeaders: logger.sanitizeHeaders(req.headers || {}),
        responseHeaders: logger.sanitizeHeaders(res.getHeaders()),
        responseSize: responseBody.length,
        ...(res.statusCode >= 400 && {
          responseBody: logger.sanitize(responseBody.substring(0, 500))
        })
      };

      logger.log(
        logLevel,
        LogCategory.NETWORK,
        `HTTP ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
        logData,
        undefined,
        requestContext
      );

      logger.clearRequestContext(requestId);
      return originalEnd.apply(res, [chunk, ...args]);
    };
  }

  // === Core Logging Implementation ===
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    error?: any,
    context?: LogContext
  ): void {
    if (level > this.config.minLevel) return;
    if (Math.random() > this.config.samplingRate) return;

    try {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        data: this.sanitize(data),
        context: this.sanitize(context),
        hostname: os.hostname(),
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
        version: this.config.version,
        service: this.config.serviceName,
        ...(context?.traceId && { traceId: context.traceId }),
        ...(context?.spanId && { spanId: context.spanId })
      };

      // Add error details if present
      if (error) {
        logEntry.data = {
          ...logEntry.data,
          error: this.sanitizeError(error)
        };
      }

      this.enqueueLog(logEntry);
    } catch (error) {
      // Fallback to safe logging
      console.error('Failed to create log entry:', error);
    }
  }

  // === Sanitization Engine ===
  private sanitize(data: any, depth: number = 0, seen: Set<any> = new Set()): any {
    if (depth > 5) return '[MAX_DEPTH_EXCEEDED]';
    if (seen.has(data)) return '[CIRCULAR_REFERENCE]';

    const newSeen = new Set(seen).add(data);

    if (data === null || data === undefined) return data;

    // Handle primitives
    if (typeof data === 'boolean' || typeof data === 'number') return data;

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    // Handle errors specially
    if (data instanceof Error) {
      return this.sanitizeError(data);
    }

    // Handle buffers
    if (Buffer.isBuffer(data)) {
      return `[BUFFER:${data.length} bytes]`;
    }

    // Handle dates
    if (data instanceof Date) {
      return data.toISOString();
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item, depth + 1, newSeen));
    }

    // Handle objects
    if (typeof data === 'object') {
      const sanitized: Record<string, any> = {};

      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveKey(key)) {
          sanitized[key] = REDACTED;
        } else if (key.toLowerCase().includes('id') || key.toLowerCase().includes('user')) {
          sanitized[key] = this.hashIdentifier(String(value));
        } else if (typeof value === 'string' && this.looksLikeSensitiveValue(value)) {
          sanitized[key] = REDACTED;
        } else {
          sanitized[key] = this.sanitize(value, depth + 1, newSeen);
        }
      }

      return sanitized;
    }

    // Fallback for any other type
    try {
      const str = String(data);
      return this.sanitizeString(str);
    } catch {
      return '[UNSERIALIZABLE_VALUE]';
    }
  }

  private sanitizeString(str: string): string {
    let sanitized = str;

    // Truncate if too long
    if (sanitized.length > this.config.maxStringLength) {
      sanitized = sanitized.substring(0, this.config.maxStringLength) + TRUNCATED_SUFFIX;
    }

    // Apply all sensitive patterns
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, REDACTED);
    });

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

    return sanitized;
  }

  private sanitizeError(error: Error): any {
    const baseError = {
      name: error.name,
      message: this.sanitizeString(error.message),
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    };

    // Handle additional error properties
    const additionalProps = Object.getOwnPropertyNames(error)
      .filter(prop => !['name', 'message', 'stack'].includes(prop))
      .reduce((acc, prop) => {
        acc[prop] = this.sanitize((error as any)[prop]);
        return acc;
      }, {} as Record<string, any>);

    return { ...baseError, ...additionalProps };
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = REDACTED;
      } else if (key.toLowerCase() === 'authorization') {
        sanitized[key] = 'Bearer [REDACTED]';
      } else if (key.toLowerCase() === 'cookie') {
        sanitized[key] = this.sanitizeCookies(String(value));
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => this.sanitizeString(String(v))).join(', ');
      } else {
        sanitized[key] = String(value);
      }
    }

    return sanitized;
  }

  private sanitizeCookies(cookieHeader: string): string {
    return cookieHeader
      .split(';')
      .map(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (this.isSensitiveKey(name)) {
          return `${name}=${REDACTED}`;
        }
        return cookie;
      })
      .join('; ');
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return this.config.sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  private looksLikeSensitiveValue(value: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
  }

  private hashIdentifier(id: string): string {
    if (!id || id === REDACTED) return id;

    try {
      const hash = crypto.createHmac('sha256', this.salt)
        .update(id)
        .digest('hex')
        .substring(0, 12);

      return `hashed:${hash}`;
    } catch {
      return REDACTED;
    }
  }

  // === Transport Layer ===
  private enqueueLog(entry: LogEntry): void {
    this.logQueue.push(entry);

    if (this.logQueue.length >= (this.config.transportConfig?.batchSize || 10)) {
      this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.isFlushing || this.logQueue.length === 0) return;

    this.isFlushing = true;
    const batch = this.logQueue.splice(0, this.config.transportConfig?.batchSize || 10);

    try {
      const transportPromises: Promise<void>[] = [];

      if (this.config.enableConsole) {
        transportPromises.push(this.consoleTransport(batch));
      }

      if (this.config.enableFile) {
        transportPromises.push(this.fileTransport(batch));
      }

      if (this.config.enableRemote) {
        transportPromises.push(this.remoteTransport(batch));
      }

      await Promise.allSettled(transportPromises);
      this.emit('logsFlushed', batch.length);
    } catch (error) {
      this.emit('transportError', error);
      console.error('Failed to flush logs:', error);
    } finally {
      this.isFlushing = false;
    }
  }

  private async consoleTransport(entries: LogEntry[]): Promise<void> {
    for (const entry of entries) {
      const formatted = this.formatConsoleEntry(entry);

      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.INFO:
          console.info(formatted);
          break;
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        default:
          console.log(formatted);
      }
    }
  }

  private formatConsoleEntry(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const category = `[${entry.category}]`.padEnd(12);

    let output = `[${timestamp}] ${levelStr} ${category} ${entry.message}`;

    if (entry.context?.requestId) {
      output += ` | req:${entry.context.requestId.substring(0, 8)}`;
    }

    if (entry.duration) {
      output += ` | ${entry.duration}ms`;
    }

    return output;
  }

  private async fileTransport(entries: LogEntry[]): Promise<void> {
    // Implement file writing logic here
    this.emit('fileTransportNotImplemented');
  }

  private async remoteTransport(entries: LogEntry[]): Promise<void> {
    // Implement remote logging to ELK, DataDog, etc.
    this.emit('remoteTransportNotImplemented');
  }

  // === Initialization and Cleanup ===
  private initializeTransports(): void {
    if (this.config.transportConfig?.flushInterval) {
      this.flushTimer = setInterval(
        () => this.flushLogs(),
        this.config.transportConfig.flushInterval
      );
    }
  }

  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }

      await this.flushLogs();
      await new Promise(resolve => setTimeout(resolve, 100));

      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('beforeExit', cleanup);
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    await this.flushLogs();
    this.removeAllListeners();
  }
}

// Export singleton instance and class
export const secureLogger = new SecureLogger();
export default secureLogger;

// Utility function for quick logging
export function createLogger(serviceName: string, config?: Partial<LoggerConfig>): SecureLogger {
  return new SecureLogger({ serviceName, ...config });
}
