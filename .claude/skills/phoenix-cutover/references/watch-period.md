# Watch Period (P15.1)

Daily summary should cover:

- Error rate (Sentry / logs)
- p95 latency (Vercel)
- Forced-reset completion rate
- Stripe webhook lag / failures
- Atlas metrics (connections, CPU)
- 429 false-positive rate (Upstash)

Escalate per ops runbook SLA. Keep Cloud Run standby until 48h window ends; keep
Supabase alive 30 days per Phoenix rollback rules.
