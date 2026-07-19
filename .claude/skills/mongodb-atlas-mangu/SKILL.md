---
name: mongodb-atlas-mangu
description: This skill should be used when working on MongoDB Atlas, lib/mongo.ts, getDb, mongo-queries, indexes, collections, avg_rating recompute, mongoimport, mongosh verification, or db:mongo:up|ping|indexes scripts for Mangu Publishers Phoenix.
version: 1.0.0
---

# MongoDB Atlas (Mangu / Phoenix WS2)

## Client pattern

- Global-cached `MongoClient` singleton (`globalThis._mongoClientPromise`)
- `getDb()` helper, **server-only**
- Filename: doc says `lib/mongo.ts`; scaffold may use `lib/mongodb.ts` (delta D2) —
  reuse scaffold, export `getDb()`, amend doc if needed

## Types (`types/mongo.ts`)

Implement: `Profile`, `Author`, `Book` (slug, cover_url, manuscript_url, avg_rating,
review_count, status), `Order` + embedded `OrderItem`, `Review`, `ReadingProgress`,
`AuditLog`. `tsc --noEmit` clean.

## Queries (`lib/mongo-queries.ts`)

- `getBooks` — aggregate with `$lookup` authors; pagination default 20
- `getBookBySlug`
- `getUserOrders`
- `searchBooks` — `$text` + score sort; pagination default 20

## Indexes & scripts

Adopt scaffold scripts when merging WS2:

- `npm run db:mongo:up`
- `npm run db:mongo:ping`
- `npm run db:mongo:indexes`

**Human runs** these with real Atlas credentials (P5.x). Agent writes/maintains scripts.

Critical index: unique sparse on `orders.stripe_payment_intent_id`.

## Mutations

- Reviews: insert then atomic recompute avg+count → `books.updateOne`
- Always `revalidatePath` after mutations (server actions)
- Audit via `lib/audit.ts` for admin role-change / suspend / content-approve

## Migration verify

`scripts/verify-migration.mongo.js` prints PASS/FAIL per check (P11.5).
Do not claim import success without it.

## Troubleshooting

- `MongoServerSelectionError` → cluster paused or IP not allowlisted
- Duplicate key on import → drop or `--mode upsert --upsertFields id`
- Never run Mongo driver inside Edge middleware

## References

- `references/schema.md`
- `references/index-spec.md`
- `references/query-recipes.md`
