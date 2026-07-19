import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { enforceRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { sendPurchaseReceiptForCheckoutSession } from '@/lib/email/triggers';

// Vercel serverless function configuration
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds timeout

// Lazy-initialize Stripe client to avoid build-time errors
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * Idempotency guard: Stripe retries webhooks on any non-2xx response, so the
 * same event can arrive more than once. Before doing any work we check for a
 * completed order carrying this session id; if one exists we acknowledge
 * without side effects.
 */
async function findOrderBySessionId(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string
) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status')
    .eq('stripe_session_id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('Error checking order by session id:', error);
    return null;
  }
  return data;
}

export async function POST(request: NextRequest) {
  // Rate limiting (fail-closed, Fix C8)
  const rateLimitResult = await enforceRateLimit('api', getClientIdentifier(request));
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error:
          rateLimitResult.reason === 'unavailable'
            ? 'Rate limiter unavailable. Please try again shortly.'
            : 'Rate limit exceeded. Please slow down.',
      },
      {
        status: rateLimitResult.reason === 'unavailable' ? 503 : 429,
        headers: rateLimitResult.headers,
      }
    );
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    console.error('Stripe client initialization failed:', error);
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 503, headers: rateLimitResult.headers }
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400, headers: rateLimitResult.headers }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 503, headers: rateLimitResult.headers }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400, headers: rateLimitResult.headers }
    );
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { book_id, user_id } = session.metadata as {
          book_id?: string;
          user_id?: string;
        };

        if (!book_id || !user_id) {
          console.error('Missing metadata in checkout session', session.id);
          break;
        }

        // Idempotency: skip if a completed order already exists
        const existingOrder = await findOrderBySessionId(supabase, session.id);
        if (existingOrder && existingOrder.status === 'completed') {
          console.log('Order already fulfilled for session', session.id);
          break;
        }

        // Resolve profile for orders.user_id (metadata carries the AUTH id)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user_id)
          .maybeSingle();

        if (profileError || !profile) {
          console.error(
            'Profile not found for auth user',
            user_id,
            profileError?.message
          );
          break;
        }

        const amount = session.amount_total ? session.amount_total / 100 : 0;
        const currency = (session.currency || 'usd').toLowerCase();

        if (existingOrder) {
          // Upgrade a pending order to completed
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: 'completed',
              amount,
              currency,
              stripe_payment_intent_id:
                typeof session.payment_intent === 'string' ? session.payment_intent : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingOrder.id);

          if (updateError) {
            console.error('Failed to complete order:', updateError);
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase.from('orders').insert({
            user_id: profile.id,
            book_id,
            amount,
            currency,
            status: 'completed',
            stripe_session_id: session.id,
            stripe_payment_intent_id:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
          });

          if (insertError) {
            // Unique-violation on stripe_session_id = concurrent delivery; safe to ignore
            if (insertError.code === '23505') {
              console.log('Concurrent webhook delivery ignored for session', session.id);
            } else {
              console.error('Failed to create order:', insertError);
              throw insertError;
            }
          }
        }

        // Grant reading access (upsert keeps it idempotent)
        const { error: progressError } = await supabase.from('reading_progress').upsert(
          {
            user_id: profile.id,
            book_id,
            current_position: 0,
            is_finished: false,
          },
          { onConflict: 'user_id,book_id', ignoreDuplicates: true }
        );

        if (progressError) {
          // Non-fatal: the reader can still access the book via order check
          console.error('Failed to seed reading progress:', progressError);
        }

        // Purchase receipt email (feat/topdog-comms). Fire-and-forget: the
        // trigger resolves the recipient, checks the 'receipts' preference,
        // and never throws — so fulfillment can never be blocked or retried
        // because of an email hiccup. Do NOT await on the hot path.
        void sendPurchaseReceiptForCheckoutSession(session);

        console.log('Checkout fulfilled', {
          sessionId: session.id,
          bookId: book_id,
          userId: user_id,
        });
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const existingOrder = await findOrderBySessionId(supabase, session.id);
        if (existingOrder && existingOrder.status === 'pending') {
          await supabase
            .from('orders')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('id', existingOrder.id);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.warn('Payment failed', {
          paymentIntentId: intent.id,
          lastPaymentError: intent.last_payment_error?.message,
        });
        break;
      }

      default:
        console.log('Unhandled webhook event type:', event.type);
    }

    return NextResponse.json(
      { received: true },
      { status: 200, headers: rateLimitResult.headers }
    );
  } catch (error) {
    console.error('Webhook handler failed:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500, headers: rateLimitResult.headers }
    );
  }
}
