---
name: mangu-content-commerce
description: This skill should be used when debugging catalog browse, book pages, purchase checkout, entitlements, downloads, reviews, reading progress, or reader/author content flows under Phoenix feature freeze.
version: 1.0.0
---

# Content & Commerce Flows

## Feature freeze

Fix parity and migration bugs only. No new storefront features.

## Critical paths

1. **Browse/search** → `getBooks` / `searchBooks` / slug page
2. **Checkout** → existing Stripe session creation; Mongo order persistence via webhook
3. **Entitlement / download** → order contains book OR admin OR author-owner → `/api/files/[id]`
4. **Reviews** → insert + avg_rating recompute + revalidate
5. **Reading progress** → per-user document updates

## Debugging order

1. Auth session valid?
2. Data layer returning expected docs?
3. Webhook delivered / idempotent order present?
4. Blob URL reachable / gate allowing?
5. Cache / `revalidatePath` stale?

## References

- `references/flow-checklist.md`
- Pair with `stripe-webhook-mangu` and `phoenix-storage-blob`
