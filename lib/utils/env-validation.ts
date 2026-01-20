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
];

/**
 * Validate all environment variables
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const config of envConfigs) {
    const value = process.env[config.name];

    if (config.required && !value) {
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
  return process.env.USE_MOCKS === 'true' || (isDevelopment() && !process.env.NEXT_PUBLIC_SUPABASE_URL);
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
