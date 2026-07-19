---
name: stripe-webhook-mangu
description: This skill should be used when working on Stripe checkout, webhooks, checkout.session.completed, payment intent idempotency, duplicate order prevention, or order creation for Mangu Publishers.
version: 1.0.0
---

# Stripe Webhook (Mangu)

## Invariants

1. Verify Stripe signature with `STRIPE_WEBHOOK_SECRET` before mutating.
2. On `checkout.session.completed` (and equivalent completed payment events used by the app):
   upsert order by `stripe_payment_intent_id`.
3. Unique **sparse** index on `orders.stripe_payment_intent_id`.
4. Duplicate delivery → **HTTP 200** (never 500 loops).
5. Reuse existing Stripe checkout session code; swap data layer only (Phoenix feature freeze).

## Upsert pattern

```ts
await db.orders.updateOne(
  { stripe_payment_intent_id: pi },
  {
    $setOnInsert: {
      /* order fields */
    },
  },
  { upsert: true }
);
// always return 200 on successful handling / duplicates
```

## Testing

- Unit: deliver webhook twice → exactly one order (WS5).
- Local: Stripe CLI forward to `/api/webhook` (or current route path).
- Docs: `docs/WEBHOOK_TESTING.md`, `docs/STRIPE_WEBHOOK_PRODUCTION.md` (update paths if routes move).

## Human gates

- Live webhook endpoint configuration in Stripe Dashboard
- Live secret rotation
- Connecting new production endpoint at cutover (P8.x)

## References

- `references/idempotency.md`
- Upstream skill: `stripe-best-practices`
