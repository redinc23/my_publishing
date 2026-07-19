# Environment Matrix

| Variable                                              | Local                        | Preview       | Prod                               | Notes                                 |
| ----------------------------------------------------- | ---------------------------- | ------------- | ---------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                | `http://localhost:3000`      | preview URL   | `https://www.mangu-publishers.com` | Canonical public URL (D4)             |
| `MONGODB_URI`                                         | Atlas or local               | Atlas         | Atlas                              | `mongodb+srv://…`                     |
| `DATABASE_PROVIDER`                                   | `mongodb`                    | `mongodb`     | `mongodb`                          | Set by bootstrap scripts              |
| `BETTER_AUTH_SECRET`                                  | generated                    | generated     | generated                          | 32+ char secret                       |
| `BETTER_AUTH_URL`                                     | site URL                     | preview URL   | prod URL                           | Must match cookie domain expectations |
| `STRIPE_SECRET_KEY`                                   | test                         | test          | live                               |                                       |
| `STRIPE_WEBHOOK_SECRET`                               | CLI/`whsec_`                 | test endpoint | live endpoint                      |                                       |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                  | test                         | test          | live                               | Survivor (D5)                         |
| `BLOB_READ_WRITE_TOKEN`                               | Vercel Blob                  | Vercel Blob   | Vercel Blob                        |                                       |
| `UPSTASH_REDIS_REST_URL`                              | optional/dev                 | required      | required                           | Rate limit                            |
| `UPSTASH_REDIS_REST_TOKEN`                            | optional/dev                 | required      | required                           |                                       |
| `RESEND_API_KEY`                                      | test/mock                    | required      | required                           | Auth emails                           |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`               | optional                     | preferred     | required                           |                                       |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | CI                           | CI            | CI                                 | Source maps                           |
| `OPENAI_API_KEY`                                      | optional                     | optional      | optional                           | Survivor features                     |
| `MCP_ENABLED`                                         | `true` only when testing MCP | as needed     | explicit                           | Default off → 404                     |
| `SUPABASE_SERVICE_ROLE_KEY`                           | TEMP scripts                 | TEMP          | TEMP until P14.4                   | Not in app code post-WS4              |
| Legacy `NEXT_PUBLIC_SUPABASE_*`                       | pre-WS4                      | remove WS4    | remove WS4                         |                                       |

Promote via Vercel project env UI or `vercel env` (human/authenticated CLI).
