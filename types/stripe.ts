/**
 * Stripe types
 */

export interface CheckoutSessionRequest {
  book_id: string;
  user_id: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}
