# verify-migration.mongo.js — Expected Check Families

Script should print PASS/FAIL for at least:

- Collection counts vs export lengths (within agreed tolerances)
- No orphan books/authors per map rules
- Unique book slugs
- Every imported credential account uses locked password prefix `!locked:`
- Sample of orders retain `stripe_payment_intent_id` when present in source
- Zero bcrypt/hash blobs copied into `account.password`
- Storage URL rewrite sampling deferred to storage skill report

Human runs via `mongosh` with Atlas URI (P11.5).
