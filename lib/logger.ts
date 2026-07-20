/**
 * Structured JSON logger (Phoenix WS6 Task 6.1.1 / enhancement E-002).
 *
 * Shape: `{ level, route, requestId, message, stack?, ...meta }`
 * Never log secrets, raw cookies, Authorization headers, or password fields.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = {
  route?: string;
  requestId?: string;
  message: string;
  stack?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEY =
  /^(authorization|cookie|password|secret|token|api[_-]?key|service[_-]?role)$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrub(v, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, fields: LogFields): void {
  const { message, route, requestId, stack, ...rest } = fields;
  const payload = scrub({
    level,
    route: route ?? null,
    requestId: requestId ?? null,
    message,
    ...(stack ? { stack } : {}),
    ...rest,
    ts: new Date().toISOString(),
  });

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    // info + debug → stdout (Vercel/Cloud Run capture both)
    console.info(line);
  }
}

export const logger = {
  debug(message: string, fields: Omit<LogFields, 'message'> = {}): void {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      emit('debug', { message, ...fields });
    }
  },
  info(message: string, fields: Omit<LogFields, 'message'> = {}): void {
    emit('info', { message, ...fields });
  },
  warn(message: string, fields: Omit<LogFields, 'message'> = {}): void {
    emit('warn', { message, ...fields });
  },
  error(message: string, fields: Omit<LogFields, 'message'> = {}): void {
    emit('error', { message, ...fields });
  },
  /** Convenience for thrown errors. */
  exception(
    message: string,
    err: unknown,
    fields: Omit<LogFields, 'message' | 'stack'> = {}
  ): void {
    const stack = err instanceof Error ? err.stack : undefined;
    const errMessage = err instanceof Error ? err.message : String(err);
    emit('error', { message, stack, errMessage, ...fields });
  },
};

export type Logger = typeof logger;
