import pino from 'pino';
import crypto from 'crypto';

// ===== CRITICAL SECURITY FIXES =====
const REDACT_PATHS = [
  'password', 'token', 'api_key', 'secret', 'ssn', 'credit_card',
  'authorization', 'cookie', 'session', 'jwt', 'refresh_token',
  'private_key', 'certificate', 'encryption_key', 'otp', 'mfa_code',
  'phone', 'address', 'dob', 'national_id', 'passport', 'tax_id'
];

const REDACT_REGEXES = [
  /(?<!\w)\d{16}(?!\w)/,           // Credit card numbers
  /(?<!\w)\d{3}-\d{2}-\d{4}(?!\w)/, // SSN
  /(?<!\w)[A-Z]{2}\d{6,9}(?!\w)/,   // Passport numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b(?!(.*@.*\..*))/, // Email partial redaction
];

export const logger = pino({
  redact: {
    paths: REDACT_PATHS,
    censor: (value, path) => {
      // Hash redacted values for debugging while maintaining privacy
      const hash = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
      return `***REDACTED:${hash}***`;
    },
    remove: true // Remove entirely in production
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => {
      const { headers, ...rest } = pino.stdSerializers.req(req);
      // Sanitize headers
      const sanitizedHeaders = Object.keys(headers).reduce((acc, key) => {
        acc[key] = REDACT_PATHS.some(path => key.toLowerCase().includes(path))
          ? '***REDACTED***'
          : headers[key];
        return acc;
      }, {} as Record<string, any>);
      return { ...rest, headers: sanitizedHeaders };
    },
    res: pino.stdSerializers.res,
  },
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
    bindings: () => ({
      pid: process.pid,
      hostname: process.env.HOSTNAME || require('os').hostname(),
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown'
    })
  },
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// ===== ADVANCED SANITIZATION =====
export function sanitizeForLog(data: any, depth: number = 0, maxDepth: number = 5): any {
  if (depth > maxDepth) return '[MAX_DEPTH_EXCEEDED]';

  if (typeof data === 'string') {
    // Truncate long strings
    const truncated = data.length > 1000 ? data.slice(0, 1000) + '...' : data;
    // Apply regex redactions
    return REDACT_REGEXES.reduce((str, regex) => str.replace(regex, '***PII_REDACTED***'), truncated);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLog(item, depth + 1, maxDepth));
  }

  if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof Buffer)) {
    return Object.entries(data).reduce((acc, [key, value]) => {
      // Redact sensitive keys
      if (REDACT_PATHS.some(path => key.toLowerCase().includes(path))) {
        acc[key] = '***REDACTED***';
      } else {
        acc[key] = sanitizeForLog(value, depth + 1, maxDepth);
      }
      return acc;
    }, {} as Record<string, any>);
  }

  return data;
}

// ===== AUDIT LOGGING =====
export class AuditLogger {
  private static instance: AuditLogger;

  static getInstance() {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  logSecurityEvent(event: string, details: Record<string, any>, userId?: string) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      event,
      userId,
      details: sanitizeForLog(details),
      severity: this.determineSeverity(event),
      ip: this.getClientIP(),
      userAgent: this.getUserAgent()
    };

    logger.child({ type: 'AUDIT' }).info(auditLog, `Security event: ${event}`);
  }

  private determineSeverity(event: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const criticalEvents = ['LOGIN_FAILURE', 'UNAUTHORIZED_ACCESS', 'RATE_LIMIT_BREACH'];
    const highEvents = ['PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'DATA_EXPORT'];
    const mediumEvents = ['USER_CREATE', 'USER_UPDATE', 'SETTINGS_CHANGE'];

    if (criticalEvents.includes(event)) return 'CRITICAL';
    if (highEvents.includes(event)) return 'HIGH';
    if (mediumEvents.includes(event)) return 'MEDIUM';
    return 'LOW';
  }

  private getClientIP(): string {
    // Implement based on your framework (Express, Fastify, etc.)
    return 'unknown';
  }

  private getUserAgent(): string {
    return 'unknown';
  }
}
