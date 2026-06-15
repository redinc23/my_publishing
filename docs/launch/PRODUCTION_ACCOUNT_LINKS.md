# Production Account Links Workbook

Use this workbook to keep launch links, owners, and evidence in one place.

**Do not paste API keys, service-role keys, webhook signing secrets, private tokens, recovery codes, passwords, or seed phrases into this file.** Store secrets only in the appropriate provider secret manager.

## Launch identity

| Item | Value |
| --- | --- |
| Production domain | `https://mangu-publishers.com` |
| GCP project ID | `delta-wonder-488420-i3` |
| GCP region | `us-central1` |
| Cloud Run service | `mangu-publishers` |
| Artifact Registry repo | `web-images` |
| Docker image name | `mangu-publishers` |
| Primary branch | `main` |

## Account links

Replace each `PASTE_URL_HERE` value with the real dashboard link.

| Service | Dashboard / resource link | Account owner | Notes |
| --- | --- | --- | --- |
| GitHub repository | [GitHub repo](PASTE_URL_HERE) |  | Private repo URL. |
| GitHub Actions | [Actions](PASTE_URL_HERE) |  | CI status. Legacy Vercel workflow is manual-only. |
| GCP project dashboard | [GCP project](PASTE_URL_HERE) |  | Project `delta-wonder-488420-i3`. |
| Cloud Build history | [Cloud Build builds](PASTE_URL_HERE) |  | Paste latest production build evidence here. |
| Cloud Run service | [Cloud Run service](PASTE_URL_HERE) |  | Service `mangu-publishers` in `us-central1`. |
| Artifact Registry repo | [Artifact Registry](PASTE_URL_HERE) |  | Repo `web-images`. |
| Secret Manager | [GCP Secret Manager](PASTE_URL_HERE) |  | Verify secret names only; do not paste values. |
| Supabase project | [Supabase project](PASTE_URL_HERE) |  | Production project dashboard. |
| Supabase API settings | [Supabase API settings](PASTE_URL_HERE) |  | Source for URL/anon/service-role key. Do not paste keys here. |
| Supabase SQL Editor | [Supabase SQL Editor](PASTE_URL_HERE) |  | Use for migration bundle. |
| Supabase Auth users | [Supabase Auth users](PASTE_URL_HERE) |  | Confirm first admin and signup tests. |
| Supabase Storage | [Supabase Storage](PASTE_URL_HERE) |  | Confirm buckets and policies. |
| Stripe dashboard | [Stripe dashboard](PASTE_URL_HERE) |  | Test/live mode owner. |
| Stripe API keys | [Stripe API keys](PASTE_URL_HERE) |  | Do not paste key values here. |
| Stripe webhooks | [Stripe webhooks](PASTE_URL_HERE) |  | Endpoint: `https://mangu-publishers.com/api/webhook`. |
| Stripe webhook logs | [Stripe webhook logs](PASTE_URL_HERE) |  | Evidence for successful delivery. |
| Domain registrar | [Registrar DNS](PASTE_URL_HERE) |  | DNS owner and records. |
| OpenAI dashboard | [OpenAI project](PASTE_URL_HERE) |  | Optional Resonance Engine. |
| Resend dashboard | [Resend project](PASTE_URL_HERE) |  | Optional email notifications. |
| Upstash Redis | [Upstash Redis](PASTE_URL_HERE) |  | Optional distributed rate limiting env vars. |

## Secret inventory

Track secret presence and owner only. Never store values here.

| Secret / variable | Storage location | Required for launch? | Owner | Status |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Cloud Build substitution | Yes |  | Not checked |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local`, Cloud Build substitution | Yes |  | Not checked |
| `SUPABASE_SERVICE_ROLE_KEY` | GCP Secret Manager: `supabase-service-role-key` | Yes |  | Not checked |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local`, Cloud Build substitution | Yes for payments |  | Not checked |
| `STRIPE_SECRET_KEY` | GCP Secret Manager: `stripe-secret-key` | Yes for payments |  | Not checked |
| `STRIPE_WEBHOOK_SECRET` | GCP Secret Manager: `stripe-webhook-secret` | Yes for payments |  | Not checked |
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, Cloud Build substitution | Yes |  | Not checked |
| `OPENAI_API_KEY` | GCP Secret Manager: `openai-api-key` | Optional |  | Not checked |
| `RESEND_API_KEY` | GCP Secret Manager: `resend-api-key` | Optional |  | Not checked |
| `UPSTASH_REDIS_REST_URL` | GCP Secret Manager: `upstash-redis-rest-url` | Optional unless fail-closed rate limiting is required |  | Not checked |
| `UPSTASH_REDIS_REST_TOKEN` | GCP Secret Manager: `upstash-redis-rest-token` | Optional unless fail-closed rate limiting is required |  | Not checked |

## Launch evidence

Paste links to logs/screenshots/tickets, not secrets.

| Evidence | Link | Result | Notes |
| --- | --- | --- | --- |
| Latest green GitHub CI run | [CI run](PASTE_URL_HERE) | Pending |  |
| Latest successful Cloud Build | [Cloud Build run](PASTE_URL_HERE) | Pending |  |
| Cloud Run revision | [Cloud Run revision](PASTE_URL_HERE) | Pending |  |
| Supabase migration proof | [Supabase evidence](PASTE_URL_HERE) | Pending |  |
| Stripe webhook proof | [Stripe webhook evidence](PASTE_URL_HERE) | Pending |  |
| Manual QA log | [Operator QA log](../OPERATOR_QA_LOG.md) | Pending |  |

