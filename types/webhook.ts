/**
 * Webhook Types
 * Comprehensive type definitions for webhook handling (primarily Stripe)
 */

import type Stripe from 'stripe';

export type WebhookProvider = 'stripe' | 'paypal' | 'custom';
export type WebhookStatus = 'pending' | 'processed' | 'failed' | 'retrying';

/**
 * Stored webhook event record
 */
export interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  provider: WebhookProvider;
  payload: Stripe.Event | Record<string, unknown>;
  processed: boolean;
  error_message?: string;
  retry_count: number;
  created_at: string;
  processed_at?: string;
}

/**
 * Result of processing a webhook
 */
export interface WebhookProcessingResult {
  success: boolean;
  error?: string;
  event_id: string;
  event_type: string;
  action_taken?: string;
  should_retry?: boolean;
}

/**
 * Webhook handler function type
 */
export type WebhookHandler<T = unknown> = (
  event: T,
  metadata: WebhookMetadata
) => Promise<WebhookProcessingResult>;

/**
 * Metadata passed to webhook handlers
 */
export interface WebhookMetadata {
  event_id: string;
  event_type: string;
  provider: WebhookProvider;
  received_at: Date;
  ip_address?: string;
  user_agent?: string;
  retry_count: number;
}

/**
 * Stripe-specific event types we handle
 */
export type StripeEventType =
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'charge.refunded'
  | 'charge.dispute.created';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  provider: WebhookProvider;
  secret: string;
  endpoint_url: string;
  enabled_events: string[];
  max_retries: number;
  retry_delay_ms: number;
}

/**
 * Checkout session metadata we expect
 */
export interface CheckoutMetadata {
  book_id: string;
  user_id: string;
  price_id?: string;
  coupon_code?: string;
}

/**
 * Order creation data from webhook
 */
export interface OrderFromWebhook {
  user_id: string;
  book_id: string;
  amount: number;
  currency: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string;
  stripe_customer_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata?: Record<string, unknown>;
}

/**
 * Webhook signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  event?: Stripe.Event;
}

/**
 * Webhook retry configuration
 */
export interface RetryConfig {
  max_attempts: number;
  base_delay_ms: number;
  max_delay_ms: number;
  exponential_base: number;
}

/**
 * Default retry config
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_attempts: 3,
  base_delay_ms: 1000,
  max_delay_ms: 30000,
  exponential_base: 2,
};

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.base_delay_ms * Math.pow(config.exponential_base, attempt);
  return Math.min(delay, config.max_delay_ms);
}