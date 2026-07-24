# SLA / Ownership Quick Matrix

| Area           | Primary owner      | Tooling                    |
| -------------- | ------------------ | -------------------------- |
| App deploy     | Platform           | Vercel                     |
| Auth           | Platform           | Better Auth + Resend       |
| Database       | Platform           | MongoDB Atlas              |
| Files          | Platform           | Vercel Blob                |
| Payments       | Platform + Finance | Stripe                     |
| Rate limit     | Platform           | Upstash Redis              |
| Errors         | Platform           | Sentry                     |
| DNS            | Platform + Human   | Cloudflare                 |
| Legacy standby | Platform + Human   | GCP Cloud Run (48h window) |

Prod domain: `https://www.mangu-publishers.com` (apex → 301 → www).
