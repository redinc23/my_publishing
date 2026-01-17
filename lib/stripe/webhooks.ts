import Stripe from 'stripe';
import { getStripe } from './server';

export async function handleStripeWebhook(body: string, signature: string): Promise<Stripe.Event> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  const stripe = getStripe();
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    webhookSecret
  );

  return event;
}
