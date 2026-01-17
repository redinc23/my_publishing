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
  userId: string;
  bookTitle: string;
  price: number;
}

export async function createCheckoutSession({
  bookId,
  userId,
  bookTitle,
  price,
}: CreateCheckoutSessionParams) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const stripe = getStripe();

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
    success_url: `${baseUrl}/books/${bookId}?success=true`,
    cancel_url: `${baseUrl}/books/${bookId}?canceled=true`,
    metadata: {
      book_id: bookId,
      user_id: userId,
    },
  });

  return session;
}
