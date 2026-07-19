---
name: phoenix-storage-blob
description: This skill should be used when working on Vercel Blob, cover_url, manuscript uploads, /api/files gated download, migrate-storage.ts, Supabase Storage copy, or remotePatterns for blob.vercel-storage.com.
version: 1.0.0
---

# Phoenix Storage / Vercel Blob (WS3)

## Platform setup

- Dependency: `@vercel/blob`
- Env: `BLOB_READ_WRITE_TOKEN`
- `next.config.js` → `images.remotePatterns`: `**.public.blob.vercel-storage.com`

## Upload path (Task 3.2)

```
{userId}/{covers|manuscripts}/{uuid}-{sanitized-original-name}
```

`put(path, file, { access: 'public' })` → store `blob.url` on book fields.

## Gated download (Task 3.3)

`app/api/files/[id]/route.ts`:

1. Auth required
2. Allow if order contains book OR admin OR author-owner
3. Else 403
4. Stream blob

## Delta D8 (must not ignore)

Public blob URLs for manuscripts are shareable if leaked despite UUID paths.
Before implementing WS3, ensure Phoenix doc records the access decision
(public + gated app route vs private blob strategy). Amend doc if product chooses differently.

## migrate-storage.ts (Task 3.4 — do not skip)

1. List Supabase Storage objects via `SUPABASE_SERVICE_ROLE_KEY` (TEMP env, not app code)
2. Download each; `put` to Blob preserving relative path
3. Rewrite `books.cover_url` / `books.manuscript_url` in Mongo
4. Idempotent: skip if target URL already exists
5. Write `storage-migration-report.json` → `{ migrated, failed, skipped }`
6. Verify: 0 failed; sample 10 URLs HEAD 200

## References

- `references/path-conventions.md`
- `references/migration-report-schema.md`
