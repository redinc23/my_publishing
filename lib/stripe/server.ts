import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeInstance;
}

// Use getStripe() instead of direct stripe export to avoid build-time errors

interface CreateCheckoutSessionParams {
  bookId: string;
  bookSlug?: string;
  /**
   * Supabase auth user id (auth.uid()). Stored in session metadata as
   * `user_id`; the webhook resolves it to profiles.id before writing
   * orders.user_id (which references profiles.id).
   */
  userId: string;
  bookTitle: string;
  price: number;
  /** Origin for success/cancel URLs; falls back to NEXT_PUBLIC_SITE_URL. */
  baseUrl?: string;
}

export async function createCheckoutSession({
  bookId,
  bookSlug,
  userId,
  bookTitle,
  price,
  baseUrl,
}: CreateCheckoutSessionParams) {
  const resolvedBaseUrl = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const stripe = getStripe();
  const bookPath = bookSlug || bookId;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: bookTitle,
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    success_url: `${resolvedBaseUrl}/books/${bookPath}?success=true`,
    cancel_url: `${resolvedBaseUrl}/books/${bookPath}?canceled=true`,
    metadata: {
      book_id: bookId,
      book_slug: bookSlug || '',
      user_id: userId,
    },
  });

  return session;
}
