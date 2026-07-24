# Human Gates (Ops)

Agents must append actionable items to `HUMAN_TASKS.md` when blocked. Do not invent credentials.

Typical gates:

- Atlas API keys, network access, cluster pause/resume
- Vercel tokens, env promotion, Log Drain attach
- Stripe webhook endpoint + live secrets
- Cloudflare DNS TTL / cutover / rollback
- Cloud Run scale / teardown
- Resend domain verification
- Production mongodump storage location
- Mass forced-reset email send approval
- Status page / customer communications

Click-paths: prefer those already listed in `HUMAN_TASKS.md` and Phoenix doc §5 / §10.
