# Forbidden Patterns

- Committing `.env`, `.env.local`, `.env.production`, or any file with real keys
- Pasting live secrets into PR bodies, issues, or skill files
- Logging tokens, cookies, or `Authorization` headers
- Using `SUPABASE_SERVICE_ROLE_KEY` in MCP handlers or client bundles
- Hardcoding connection strings in `lib/` or `app/`
- "Temporary" secrets in git "just for CI" — use GitHub/Vercel secret stores
- Disabling env validation to "make the build pass"
