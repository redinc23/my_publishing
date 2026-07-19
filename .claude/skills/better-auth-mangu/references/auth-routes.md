# Auth Routes & Surfaces

## App Router (authoritative)

Legacy Supabase-era paths under `app/(auth)/` (login, register, reset-password,
verify-email, callback) migrate to Better Auth actions/client calls in WS1.

API:

- `app/api/auth/[...all]/route.ts` — Better Auth handler
- Retire Supabase-oriented `app/api/session/route.ts` patterns as replaced

## Emails

- Verification: Resend via Better Auth `sendVerificationEmail`
- Reset: Resend via `sendResetPassword` + `emails/reset.tsx`

## Profiles

Created on user create hook — do not assume Supabase `profiles` RLS; enforce in app code.
