# Optional Services Setup

Enable production observability and Phase 2 features. All are **optional for launch** except what you explicitly want live.

## Quick priority

| Service    | What it does                    | Launch priority                      |
| ---------- | ------------------------------- | ------------------------------------ |
| **Sentry** | Error tracking + session replay | Recommended                          |
| **Resend** | Transactional email             | Needed for password reset / receipts |
| **OpenAI** | AI recommendations (Resenace)   | Nice-to-have                         |

---

## 1. Sentry (error monitoring)

### Create the project

1. Go to [sentry.io](https://sentry.io) → **Create project** → **Next.js**
2. Copy the **DSN** (looks like `https://xxxx@o123.ingest.us.sentry.io/456`)

### Add to `.env.local`

```env
NEXT_PUBLIC_SENTRY_DSN=https://YOUR_DSN_HERE
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=mangu-publishers
```

`NEXT_PUBLIC_SENTRY_DSN` is enough for client + server. `SENTRY_DSN` is optional if you use the same value.

### Optional: source maps (readable stack traces in prod)

1. Sentry → **Settings → Auth Tokens** → Create token with `project:releases` + `org:read`
2. Add to `.env.local`:

```env
SENTRY_AUTH_TOKEN=sntrys_...
```

3. Sync to GCP (build-time only):

```bash
./scripts/sync-gcp-secrets-from-env.sh
```

### Deploy

Sentry DSN is **baked at build time** like other `NEXT_PUBLIC_*` vars:

```bash
./scripts/sync-gcp-secrets-from-env.sh   # if you added SENTRY_AUTH_TOKEN
./scripts/gcloud-build-submit.sh
```

### Verify

1. Trigger a test error locally: `throw new Error('Sentry test')` in a dev-only route, or use Sentry's "Test connection"
2. After deploy, check Sentry dashboard → **Issues** — events should tag release = git SHA

**Code wired:** `instrumentation.ts`, `sentry.*.config.ts`, `app/error.tsx`, `app/global-error.tsx`, `ErrorBoundary`

---

## 2. Resend (email)

### When you need it

- Password reset emails
- Purchase confirmations
- Manuscript status notifications

Without `RESEND_API_KEY`, email sends fail unless `SKIP_EMAILS=true`.

### Setup

1. [resend.com](https://resend.com) → **API Keys** → Create
2. Add domain `mangu-publishers.com` (or your sending domain) and verify DNS
3. Add to `.env.local`:

```env
RESEND_API_KEY=re_...
```

4. Sync + redeploy:

```bash
./scripts/sync-gcp-secrets-from-env.sh
./scripts/gcloud-build-submit.sh
```

**Note:** `lib/email/send.ts` sends from `noreply@mangu.app` — update that address after you verify your domain in Resend.

---

## 3. OpenAI (AI recommendations)

### When you need it

- `/discover/recommendations` and Resonance Engine features
- Without it, those features return empty or cached results

### Setup

1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Add to `.env.local`:

```env
OPENAI_API_KEY=sk-proj-...
```

3. Sync + redeploy:

```bash
./scripts/sync-gcp-secrets-from-env.sh
./scripts/gcloud-build-submit.sh
```

---

## Already configured (you have these)

| Service  | Status                                    |
| -------- | ----------------------------------------- |
| Supabase | Required — DB + auth                      |
| Stripe   | Required — payments (you're on test keys) |
| Upstash  | Required for prod rate limiting           |

---

## After adding any key

```bash
npm run validate-env
./scripts/sync-gcp-secrets-from-env.sh
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
```

See also: [LAUNCH_NOW.md](./LAUNCH_NOW.md), [PHASE4_OPERATOR_RUNBOOK.md](./PHASE4_OPERATOR_RUNBOOK.md)
