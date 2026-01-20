/**
 * Stripe Configuration Validation
 * Validates Stripe API keys and configuration
 */

import Stripe from 'stripe';

interface StripeValidationResult {
  valid: boolean;
  publishableKeyValid: boolean;
  secretKeyValid: boolean;
  webhookSecretValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Stripe configuration
 */
export function validateStripeConfig(): StripeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Check publishable key format
  const publishableKeyValid = !!publishableKey && publishableKey.startsWith('pk_');
  if (!publishableKey) {
    warnings.push('Stripe publishable key not set (payments will not work)');
  } else if (!publishableKeyValid) {
    errors.push('Stripe publishable key format invalid (must start with pk_)');
  }

  // Check secret key format
  const secretKeyValid = !!secretKey && secretKey.startsWith('sk_');
  if (!secretKey) {
    warnings.push('Stripe secret key not set (payments will not work)');
  } else if (!secretKeyValid) {
    errors.push('Stripe secret key format invalid (must start with sk_)');
  }

  // Check webhook secret format
  const webhookSecretValid = !!webhookSecret && webhookSecret.startsWith('whsec_');
  if (!webhookSecret) {
    warnings.push('Stripe webhook secret not set (webhooks will not be verified)');
  } else if (!webhookSecretValid) {
    errors.push('Stripe webhook secret format invalid (must start with whsec_)');
  }

  // Check key consistency (both test or both live)
  if (publishableKey && secretKey) {
    const publishableIsTest = publishableKey.startsWith('pk_test_');
    const secretIsTest = secretKey.startsWith('sk_test_');
    if (publishableIsTest !== secretIsTest) {
      errors.push('Stripe key mismatch: publishable and secret keys must both be test or both be live');
    }
  }

  return {
    valid: errors.length === 0,
    publishableKeyValid,
    secretKeyValid,
    webhookSecretValid,
    errors,
    warnings,
  };
}

/**
 * Test Stripe API connection (makes a lightweight API call)
 */
export async function testStripeConnection(): Promise<{
  success: boolean;
  error?: string;
  latency_ms?: number;
}> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sk_')) {
    return {
      success: false,
      error: 'Stripe secret key not configured or invalid',
    };
  }

  const start = Date.now();
  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });

    // Make a lightweight API call to verify connection
    await stripe.balance.retrieve();
    const latency = Date.now() - start;

    return {
      success: true,
      latency_ms: latency,
    };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    if (errorMessage.includes('Invalid API Key')) {
      return {
        success: false,
        error: 'Invalid Stripe API key',
        latency_ms: latency,
      };
    }

    if (errorMessage.includes('rate_limit')) {
      return {
        success: false,
        error: 'Stripe API rate limit exceeded',
        latency_ms: latency,
      };
    }

    return {
      success: false,
      error: errorMessage,
      latency_ms: latency,
    };
  }
}
