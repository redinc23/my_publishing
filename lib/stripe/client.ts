import { loadStripe, Stripe } from '@stripe/stripe-js';

/**
 * Creates a Stripe client for use in Client Components
 */
export async function getStripe(): Promise<Stripe | null> {
  const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripeKey) {
    throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
  }
  return loadStripe(stripeKey);
}
