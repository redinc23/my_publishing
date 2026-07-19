# Webhook Idempotency Checklist

- [ ] Unique sparse index exists on `stripe_payment_intent_id`
- [ ] Handler uses upsert / `$setOnInsert` (not blind insert)
- [ ] Duplicate event returns 200
- [ ] Signature failure returns 400 (not 200)
- [ ] No side effects (emails, entitlements) before durable order write — or make them idempotent too
- [ ] WS5 test covers double delivery
