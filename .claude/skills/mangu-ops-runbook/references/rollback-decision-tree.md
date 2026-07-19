# Rollback Decision Tree

## Triggers (Phoenix §8.2)

Execute rollback consideration if **any** apply (see full list in Phoenix doc):

- Sustained `ready:false` / 5xx spike after cutover
- Auth broken for non-legacy users (new signups / verified users)
- Payment path broken (checkout or webhook)
- Data corruption / integrity check failures
- Security incident involving new stack credentials

Decision time limit: **≤ 60 minutes** from trigger to Go/No-Go.

## DNS rollback (human)

1. Cloudflare A/AAAA → Cloud Run IPs
2. Wait propagation (1–5 min)
3. Verify curl hits Cloud Run
4. Scale Cloud Run min-instances back to 1

## Code rollback

1. Revert merge commits on `main` as needed
2. Vercel redeploys
3. Re-enable Supabase env vars on Vercel if removed

## Data divergence

1. Do **not** delete Mongo
2. Run `scripts/export-delta.ts` for Phoenix-window writes
3. Supabase remains SoT on full rollback; replay where feasible
4. Archive non-replayable with P14.2 mongodump

Agents: prepare evidence packs; humans execute DNS and console steps.
