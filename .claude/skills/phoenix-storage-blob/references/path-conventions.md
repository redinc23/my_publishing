# Blob Path Conventions

- Covers: `{userId}/covers/{uuid}-{sanitizedName}`
- Manuscripts: `{userId}/manuscripts/{uuid}-{sanitizedName}`
- Sanitize: strip path separators, collapse whitespace, preserve safe extension
- Never store unsanitized user filenames as the sole path segment
- App should prefer serving manuscripts through `/api/files/[id]` even if blob is public
