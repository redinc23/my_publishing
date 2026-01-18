/**
 * Environment variable validation
 * This file validates required environment variables at application startup
 * to prevent runtime errors from missing configuration
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;

const optionalEnvVars = [
  'OPENAI_API_KEY', // Optional - AI features
  'RESEND_API_KEY', // Optional - Email notifications
] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];
type OptionalEnvVar = (typeof optionalEnvVars)[number];

/**
 * Validates that all required environment variables are set
 * @throws Error if any required environment variable is missing
 */
export function validateEnv(): void {
  const missing: RequiredEnvVar[] = [];
  const warnings: OptionalEnvVar[] = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables
  for (const envVar of optionalEnvVars) {
    if (!process.env[envVar]) {
      warnings.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((v) => `  - ${v}`).join('\n')}\n\n` +
        'Please set these variables in your .env.local file or deployment environment.'
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(
      'Warning: Optional environment variables not set:\n' +
        warnings.map((v) => `  - ${v}`).join('\n') +
        '\nSome features may be disabled.'
    );
  }

  // Validate URL formats
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    } catch {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL must be a valid URL'
      );
    }
  }
}

/**
 * Gets a required environment variable
 * @throws Error if the variable is not set
 */
export function getRequiredEnv(name: RequiredEnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
export function getOptionalEnv(name: OptionalEnvVar, defaultValue = ''): string {
  return process.env[name] || defaultValue;
}
