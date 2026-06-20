# AGENTS.md

## Cursor Cloud specific instructions

MANGU Publishers is a single Next.js 14 (App Router) app (the only service). It uses
Supabase (Postgres/Auth/Storage), Stripe, and optionally OpenAI/Resend/Upstash as
external backing services. There is no `docker-compose`/devcontainer; package manager is
npm (`package-lock.json`). Standard scripts live in `package.json` (`dev`, `lint`,
`type-check`, `test`, `build`); the README documents them.

### Running without real external services (mock mode)
- No real Supabase/Stripe credentials are configured in this environment. The app is meant
  to run with `USE_MOCKS=true` plus placeholder env vars, exactly like CI
  (`.github/workflows/ci.yml`) and `./scripts/ci-local.sh`.
- The update script writes a local `.env.local` (it is gitignored) with `USE_MOCKS=true`
  and placeholder Supabase/Stripe values so `npm run dev` and `npm run validate-env` pass.
  If `.env.local` is missing, recreate it from `.env.local.example` with those placeholders.
- `npm run dev` runs `validate-env` first; it only hard-requires the three
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
  vars to be present (placeholders are fine). Missing Stripe keys only produce warnings.

### Non-obvious gotcha: mock data is NOT wired into pages
- `lib/utils/mock-data.ts` exists but its helpers (`getMockBooks`, etc.) are not imported by
  any page. In mock mode the Supabase queries are bypassed/return empty, so data-driven
  pages (`/books`, homepage book rows) render their empty states ("No books found"), and
  server actions that hit Supabase (e.g. registration) return a "Database connection error".
  This is expected without a real Supabase project — it is not an environment failure.
- To exercise real data/auth/payment flows end-to-end you must provision a real Supabase
  project (apply the ordered migrations in `supabase/migrations/`, see README) and add
  Stripe test keys; client-side behavior (form validation, navigation) works without them.

### Lint/test/build/run
- Lint and type-check run without env vars. Unit tests (`npm test`, Jest) and `npm run build`
  expect the mock env vars to be set (the update script's `.env.local` covers `npm run dev`;
  for `npm test`/`npm run build` prefer the values from `./scripts/ci-local.sh`, which mirrors
  CI end-to-end). `npm run test:e2e` (Playwright) needs browsers via `npx playwright install`.
- Node: `.nvmrc` pins 20 (CI uses 20); `engines` is `>=20`, so the system Node 20/22 works.
