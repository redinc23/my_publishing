/**
 * Stripe Webhook Handler
 * Production-grade webhook processing with idempotency and retry logic
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { webhookRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit';
import { getStripe } from '@/lib/stripe/server';
import type { 
  WebhookProcessingResult, 
  CheckoutMetadata, 
  OrderFromWebhook 
} from '@/types/webhook';

// Webhook secret for signature verification
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Verify Stripe webhook signature
 */
function verifySignature(
  payload: string,
  signature: string
): { valid: boolean; event?: Stripe.Event; error?: string } {
  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return { valid: true, event };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Webhook] Signature verification failed:', message);
    return { valid: false, error: message };
  }
}

/**
 * Check if event was already processed (idempotency)
 */
async function checkIdempotency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string
): Promise<{ processed: boolean; recordId?: string }> {
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id, processed')
    .eq('event_id', eventId)
    .single();

  if (existing?.processed) {
    return { processed: true, recordId: existing.id };
  }

  return { processed: false, recordId: existing?.id };
}

/**
 * Record webhook event for idempotency tracking
 */
async function recordWebhookEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: Stripe.Event
): Promise<void> {
  await supabase.from('webhook_events').upsert(
    {
      event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    },
    { onConflict: 'event_id' }
  );
}

/**
 * Mark webhook event as processed
 */
async function markEventProcessed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  error?: string
): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({
      processed: !error,
      error_message: error || null,
      processed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId);
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Stripe.Checkout.Session
): Promise<WebhookProcessingResult> {
  const metadata = session.metadata as CheckoutMetadata | null;

  // Validate required metadata
  if (!metadata?.book_id || !metadata?.user_id) {
    console.error('[Webhook] Missing required metadata in checkout session:', session.id);
    return {
      success: false,
      error: 'Missing required metadata (book_id or user_id)',
      event_id: session.id,
      event_type: 'checkout.session.completed',
    };
  }

  // Check for duplicate order (additional idempotency check)
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .single();

  if (existingOrder) {
    console.log('[Webhook] Order already exists for session:', session.id);
    return {
      success: true,
      event_id: session.id,
      event_type: 'checkout.session.completed',
      action_taken: 'Order already exists, skipped creation',
    };
  }

  // Create the order
  const orderData: OrderFromWebhook = {
    user_id: metadata.user_id,
    book_id: metadata.book_id,
    amount: session.amount_total ? session.amount_total / 100 : 0,
    currency: session.currency?.toUpperCase() || 'USD',
    stripe_session_id: session.id,
    stripe_payment_intent_id: session.payment_intent as string,
    stripe_customer_id: session.customer as string | undefined,
    status: 'completed',
    metadata: metadata as unknown as Record<string, unknown>,
  };

  const { error: orderError } = await supabase.from('orders').insert(orderData);

  if (orderError) {
    console.error('[Webhook] Failed to create order:', orderError);
    return {
      success: false,
      error: `Failed to create order: ${orderError.message}`,
      event_id: session.id,
      event_type: 'checkout.session.completed',
      should_retry: true,
    };
  }

  // Track analytics event
  await supabase.from('analytics_events').insert({
    book_id: metadata.book_id,
    user_id: metadata.user_id,
    event_type: 'purchase',
    session_id: session.id,
    event_data: {
      amount: orderData.amount,
      currency: orderData.currency,
    },
  });

  console.log('[Webhook] Order created successfully:', session.id);

  return {
    success: true,
    event_id: session.id,
    event_type: 'checkout.session.completed',
    action_taken: 'Order created successfully',
  };
}

/**
 * Handle checkout.session.expired event
 */
async function handleCheckoutExpired(
  session: Stripe.Checkout.Session
): Promise<WebhookProcessingResult> {
  console.log('[Webhook] Checkout session expired:', session.id);
  
  // Optionally track abandoned checkout
  return {
    success: true,
    event_id: session.id,
    event_type: 'checkout.session.expired',
    action_taken: 'Logged expired session',
  };
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  charge: Stripe.Charge
): Promise<WebhookProcessingResult> {
  const paymentIntentId = charge.payment_intent as string;

  // Find the order by payment intent
  const { data: order, error: findError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (findError || !order) {
    console.warn('[Webhook] Order not found for refund:', paymentIntentId);
    return {
      success: true,
      event_id: charge.id,
      event_type: 'charge.refunded',
      action_taken: 'Order not found, logged for review',
    };
  }

  // Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'refunded',
      refund_reason: charge.refunds?.data[0]?.reason || 'No reason provided',
    })
    .eq('id', order.id);

  if (updateError) {
    console.error('[Webhook] Failed to update order status:', updateError);
    return {
      success: false,
      error: `Failed to update order: ${updateError.message}`,
      event_id: charge.id,
      event_type: 'charge.refunded',
      should_retry: true,
    };
  }

  return {
    success: true,
    event_id: charge.id,
    event_type: 'charge.refunded',
    action_taken: 'Order marked as refunded',
  };
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(
  charge: Stripe.PaymentIntent
): Promise<WebhookProcessingResult> {
  console.warn('[Webhook] Payment failed:', charge.id, charge.last_payment_error?.message);

  // Could trigger email notification here

  return {
    success: true,
    event_id: charge.id,
    event_type: 'payment_intent.payment_failed',
    action_taken: 'Logged payment failure',
  };
}

/**
 * Main webhook handler
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Rate limiting
  const clientId = getClientIdentifier(request);
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  if (!webhookRateLimit.check(1000, clientId)) {
    console.warn('[Webhook] Rate limit exceeded for:', clientId);
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // Get raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  // Verify signature
  const verification = verifySignature(body, signature);
  if (!verification.valid || !verification.event) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${verification.error}` },
      { status: 400 }
    );
  }

  const event = verification.event;
  console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

  // Initialize Supabase client
  const supabase = await createClient();

  // Check idempotency
  const idempotencyCheck = await checkIdempotency(supabase, event.id);
  if (idempotencyCheck.processed) {
    console.log(`[Webhook] Event already processed: ${event.id}`);
    return NextResponse.json({
      received: true,
      message: 'Event already processed',
    });
  }

  // Record the event
  await recordWebhookEvent(supabase, event);

  // Process the event
  let result: WebhookProcessingResult;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        result = await handleCheckoutCompleted(supabase, session);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        result = await handleCheckoutExpired(session);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        result = await handleChargeRefunded(supabase, charge);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        result = await handlePaymentFailed(paymentIntent);
        break;
      }

      default: {
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        result = {
          success: true,
          event_id: event.id,
          event_type: event.type,
          action_taken: 'Event type not handled',
        };
      }
    }

    // Mark as processed
    await markEventProcessed(supabase, event.id, result.success ? undefined : result.error);

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Processed ${event.type} in ${duration}ms:`, result);

    if (!result.success && result.should_retry) {
      // Return 500 to trigger Stripe retry
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      received: true,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Webhook] Error processing ${event.type}:`, error);

    // Mark as failed
    await markEventProcessed(supabase, event.id, errorMessage);

    // Return 500 to trigger retry for unexpected errors
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Reject non-POST requests
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}