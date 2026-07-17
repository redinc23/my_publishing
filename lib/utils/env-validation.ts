/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

interface EnvConfig {
  name: string;
  required: boolean;
  /**
   * Required for launch, but may be omitted when USE_MOCKS=true
   * (local dev / CI without live Stripe or Upstash credentials). Fix C9.
   */
  requiredUnlessMocks?: boolean;
  description: string;
  validate?: (value: string) => boolean | string;
}

const envConfigs: EnvConfig[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    validate: (value) => {
      if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
        return 'Must be a valid Supabase URL (https://*.supabase.co)';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
    validate: (value) => {
      if (value.length < 20) {
        return 'Supabase anon key appears invalid';
      }
      return true;
    },
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (for admin operations)',
    validate: (value) => {
      if (value.length < 20) {
        return 'Supabase service role key appears invalid';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    requiredUnlessMocks: true,
    description: 'Stripe publishable key (required for payments)',
    validate: (value) => {
      if (value && !value.startsWith('pk_')) {
        return 'Stripe publishable key must start with pk_';
      }
      return true;
    },
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    requiredUnlessMocks: true,
    description: 'Stripe secret key (required for payments)',
    validate: (value) => {
      if (value && !value.startsWith('sk_')) {
        return 'Stripe secret key must start with sk_';
      }
      return true;
    },
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: false,
    description: 'Stripe webhook secret (required for webhook verification)',
    validate: (value) => {
      if (value && !value.startsWith('whsec_')) {
        return 'Stripe webhook secret must start with whsec_';
      }
      return true;
    },
  },
  {
    name: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key (required for AI recommendations)',
    validate: (value) => {
      if (value && !value.startsWith('sk-')) {
        return 'OpenAI API key must start with sk-';
      }
      return true;
    },
  },
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key (required for sending emails)',
    validate: (value) => {
      if (value && !value.startsWith('re_')) {
        return 'Resend API key must start with re_';
      }
      return true;
    },
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false,
    requiredUnlessMocks: true,
    description: 'Upstash Redis REST URL (required for distributed rate limiting)',
    validate: (value) => {
      if (value && !value.startsWith('https://')) {
        return 'Upstash REST URL must start with https://';
      }
      return true;
    },
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    requiredUnlessMocks: true,
    description: 'Upstash Redis REST token (required for distributed rate limiting)',
    validate: (value) => {
      if (value && value.length < 10) {
        return 'Upstash REST token appears invalid';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    required: false,
    description: 'Base URL of the application',
    validate: (value) => {
      if (value && !value.match(/^https?:\/\//)) {
        return 'Site URL must start with http:// or https://';
      }
      return true;
    },
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for client and server error tracking (optional)',
    validate: (value) => {
      if (value && !value.startsWith('https://')) {
        return 'Sentry DSN must be an https:// ingest URL';
      }
      return true;
    },
  },
  {
    name: 'SENTRY_DSN',
    required: false,
    description: 'Server-only Sentry DSN (optional; defaults to NEXT_PUBLIC_SENTRY_DSN)',
  },
];

/**
 * Validate all environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const mocksEnabled = process.env.USE_MOCKS === 'true';

  for (const config of envConfigs) {
    const value = process.env[config.name];
    const isRequired = config.required || (config.requiredUnlessMocks === true && !mocksEnabled);

    if (isRequired && !value) {
      missing.push(config.name);
      continue;
    }

    if (value && config.validate) {
      const validationResult = config.validate(value);
      if (validationResult !== true) {
        warnings.push(`${config.name}: ${validationResult}`);
      }
    }
  }

  // Check for Stripe configuration completeness
  const hasStripePublishable = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasStripeWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;

  if (hasStripePublishable || hasStripeSecret || hasStripeWebhook) {
    if (!hasStripePublishable) {
      warnings.push('Stripe publishable key missing (required if using Stripe)');
    }
    if (!hasStripeSecret) {
      warnings.push('Stripe secret key missing (required if using Stripe)');
    }
    if (!hasStripeWebhook) {
      warnings.push('Stripe webhook secret missing (required for webhook verification)');
    }
  }

  const hasUpstashUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasUpstashToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  if (hasUpstashUrl !== hasUpstashToken) {
    warnings.push(
      'Upstash rate limiting requires both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'
    );
  } else if (
    !hasUpstashUrl &&
    process.env.NODE_ENV === 'production' &&
    process.env.USE_MOCKS !== 'true'
  ) {
    warnings.push(
      'Upstash Redis not configured — distributed rate limiting disabled in production'
    );
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;

  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }

  return value;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if mock mode is enabled
 */
export function useMocks(): boolean {
  return (
    process.env.USE_MOCKS === 'true' || (isDevelopment() && !process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

/**
 * Check if emails should be skipped
 */
export function skipEmails(): boolean {
  return process.env.SKIP_EMAILS === 'true' || (isDevelopment() && !process.env.RESEND_API_KEY);
}

/**
 * Print environment validation results (for CLI usage)
 */
export function printValidationResults(result: EnvValidationResult): void {
  if (result.valid && result.warnings.length === 0) {
    console.log('✅ All environment variables are valid');
    return;
  }

  if (result.missing.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    result.missing.forEach((name) => {
      const config = envConfigs.find((c) => c.name === name);
      console.error(`   - ${name}: ${config?.description || 'Required'}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Environment variable warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
  }
}
