# Purchase → Download Checklist

- [ ] User authenticated
- [ ] Checkout session created with correct price/book metadata
- [ ] Webhook received and signature OK
- [ ] Order upserted once for `stripe_payment_intent_id`
- [ ] Library/entitlement reads order items
- [ ] `/api/files/[id]` authorizes and streams
- [ ] Cover images load via Blob remotePatterns
