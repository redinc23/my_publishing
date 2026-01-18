import { z } from 'zod';

// Circuit Breaker specific schema
const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number()
    .min(1)
    .max(100)
    .default(5)
    .describe('Number of failures before opening the circuit'),

  resetTimeout: z.number()
    .min(1000)
    .max(300000)
    .default(60000)
    .describe('Time in ms before attempting to close the circuit'),

  timeout: z.number()
    .min(100)
    .max(60000)
    .default(10000)
    .describe('Request timeout in milliseconds'),

  slidingWindowSize: z.number()
    .min(10)
    .max(1000)
    .default(100)
    .describe('Number of requests to track in the sliding window'),

  enableBulkhead: z.boolean()
    .default(true)
    .describe('Enable bulkhead pattern for concurrent request limiting'),

  bulkheadMaxConcurrent: z.number()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum concurrent requests when bulkhead is enabled'),

  enableHalfOpenState: z.boolean()
    .default(true)
    .describe('Enable half-open state for circuit breaker'),

  halfOpenMaxAttempts: z.number()
    .min(1)
    .max(10)
    .default(3)
    .describe('Maximum attempts in half-open state before closing or reopening'),

  enableHealthCheck: z.boolean()
    .default(true)
    .describe('Enable periodic health checks for closed circuits'),

  healthCheckInterval: z.number()
    .min(30000)
    .max(300000)
    .default(60000)
    .describe('Health check interval in milliseconds'),
});

// Main Config Schema
const ConfigSchema = z.object({
  // Existing config
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  supabaseUrl: z.string().url().optional(),
  supabaseServiceKey: z.string().min(20).optional(),
  openaiApiKey: z.string().optional(),
  redisUrl: z.string().url().optional(),
  maxConnections: z.number().min(1).max(100).default(20),
  enableCircuitBreaker: z.boolean().default(true),
  enableRateLimiting: z.boolean().default(true),

  // New: Circuit Breaker config
  circuitBreaker: CircuitBreakerConfigSchema.default({}),

  // Feature flags for circuit breaker
  circuitBreakerEnabledServices: z
    .string()
    .transform(str => str.split(',').map(s => s.trim()).filter(Boolean))
    .default('*')
    .describe('Comma-separated list of services to enable circuit breaker for, or "*" for all'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;

// Helper to parse circuit breaker specific environment variables
function parseCircuitBreakerEnv(): CircuitBreakerConfig {
  return {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '60000'),
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '10000'),
    slidingWindowSize: parseInt(process.env.CIRCUIT_BREAKER_SLIDING_WINDOW_SIZE || '100'),
    enableBulkhead: process.env.CIRCUIT_BREAKER_ENABLE_BULKHEAD !== 'false',
    bulkheadMaxConcurrent: parseInt(process.env.CIRCUIT_BREAKER_BULKHEAD_MAX_CONCURRENT || '10'),
    enableHalfOpenState: process.env.CIRCUIT_BREAKER_ENABLE_HALF_OPEN !== 'false',
    halfOpenMaxAttempts: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_ATTEMPTS || '3'),
    enableHealthCheck: process.env.CIRCUIT_BREAKER_ENABLE_HEALTH_CHECK !== 'false',
    healthCheckInterval: parseInt(process.env.CIRCUIT_BREAKER_HEALTH_CHECK_INTERVAL || '60000'),
  };
}

// Transform environment variables to config
export function validateEnvironment(): AppConfig {
  try {
    const parsed = ConfigSchema.parse({
      nodeEnv: process.env.NODE_ENV,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      redisUrl: process.env.REDIS_URL,
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
      enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
      enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      circuitBreaker: parseCircuitBreakerEnv(),
      circuitBreakerEnabledServices: process.env.CIRCUIT_BREAKER_ENABLED_SERVICES || '*',
    });

    // Log config in development
    if (parsed.nodeEnv === 'development') {
      console.debug('✅ Environment config validated:', {
        enableCircuitBreaker: parsed.enableCircuitBreaker,
        circuitBreakerConfig: parsed.circuitBreaker,
      });
    }

    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ Environment validation failed:', error);
    }

    // In production, exit with error
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // In development/test, return minimal config
    return ConfigSchema.parse({
      nodeEnv: 'development',
      circuitBreaker: parseCircuitBreakerEnv(),
    });
  }
}

export const config = validateEnvironment();

// Helper to get circuit breaker config for a specific service
export function getCircuitBreakerConfig(serviceName: string): CircuitBreakerConfig & { enabled: boolean } {
  const isServiceEnabled = config.circuitBreakerEnabledServices.includes('*') ||
                          config.circuitBreakerEnabledServices.includes(serviceName);

  return {
    ...config.circuitBreaker,
    enabled: config.enableCircuitBreaker && isServiceEnabled,
  };
}
