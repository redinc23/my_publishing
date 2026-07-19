---
name: phoenix-data-migration
description: This skill should be used when working on Phase 11 data migration — export-supabase, transform-data, mongoimport, locked credential accounts, _id_map.json, export-delta, send-forced-resets, or verify-migration.mongo.js.
version: 1.0.0
---

# Phoenix Data Migration (Phase 11 support)

Agents **write** scripts; humans **execute** with real credentials.

## Script set

1. `scripts/export-supabase.sh` — `\copy` / json_agg exports per Phoenix §5.5 P11.1  
   → `export/`; verify with `jq length export/*.json`
2. `scripts/transform-data.ts` — Tasks 2.1–2.8 **exactly**
3. `scripts/migrate-storage.ts` — see `phoenix-storage-blob` skill
4. `scripts/export-delta.ts` — Phoenix-window writes since timestamp (rollback)
5. `scripts/send-forced-resets.ts` — batch `requestPasswordReset`
6. `scripts/verify-migration.mongo.js` — mongosh PASS/FAIL checks

## Transform hard rules

- `user.id` = legacy UUID string
- `emailVerified` from `email_confirmed_at`
- `name` from `raw_user_meta_data`
- `account`: `{ providerId: "credential", accountId: id, userId: id, password: "!locked:<uuid>" }`
- **NEVER copy bcrypt hashes**
- Persist UUID→ObjectId map to `export/_id_map.json`
- Remap authors/books; unique slug generation
- Init `avg_rating: 0`, `review_count: 0`
- Flatten orders → embedded `order_items[]`; preserve `stripe_payment_intent_id`
- ISO strings → native Dates
- Emit transform report: counts, orphans, collisions

## Execution order (human)

P11.1 export → P11.2 transform → P11.3 dry-run Better Auth round-trip →  
P11.4 mongoimport → P11.5 verify → P11.6 sign-off → then code cutover gates.

## References

- `references/transform-tasks.md`
- `references/verify-checks.md`
- Assets: `assets/transform-report-template.md`
