# Stripe Webhook — Production Setup

After Cloud Run is live with a public URL or custom domain:

## 1. Create endpoint (Stripe Dashboard)

1. [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. **Add endpoint**
3. **URL:** `https://YOUR_PRODUCTION_DOMAIN/api/webhook`
4. **Events:** At minimum `checkout.session.completed` (see [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md) for full list)
5. Copy **Signing secret** (`whsec_…`)

## 2. Store secret

| Target                | Where                                        |
| --------------------- | -------------------------------------------- |
| Cloud Run (canonical) | GCP Secret Manager → `stripe-webhook-secret` |

```bash
# After gcloud auth login and real whsec value:
echo -n 'whsec_...' | gcloud secrets create stripe-webhook-secret --data-file=- --project=YOUR_PROJECT_ID
# Or: ./scripts/sync-gcp-secrets-from-env.sh  (uses STRIPE_WEBHOOK_SECRET from .env.local)
```

## 3. Redeploy

Trigger Cloud Build so the new secret version is mounted on the Cloud Run service.

## 4. Verify

- Stripe Dashboard → Webhook → **Send test webhook**
- App logs / `/api/health` should show Stripe configured
