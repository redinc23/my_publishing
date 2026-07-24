# Post-WS4 Supabase Grep

```bash
rg -i supabase app/ lib/ components/ types/ || true
# Expect: no code hits. Docs/scripts TEMP mentions should be intentional and outside these dirs.
```

Allowlisted TEMP usage for migration scripts may reference Supabase **outside** those dirs
until Phase 14 — never reintroduce `@supabase/*` app imports after purge.
