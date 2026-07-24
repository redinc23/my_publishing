---
name: better-auth-mangu
description: This skill should be used when working on Better Auth, login/signup/verify/reset, session cookies, forced password reset for legacy users, roles reader|author|editor|admin, auth middleware, Resend verification emails, or scripts/request-password-reset.ts for Mangu Publishers Phoenix WS1.
version: 1.0.0
---

# Better Auth (Mangu / Phoenix WS1)

## Target shape (`lib/auth.ts`)

- Adapter: `mongodbAdapter(getDb())`
- `emailAndPassword`: enabled, `requireEmailVerification: true`
- `user.additionalFields.role`: string, default `"reader"`, `input: false`
  Allowed: `reader | author | partner | admin` (D9 — not `editor`)
- Email verification + reset via Resend; branded template `emails/reset.tsx`
- `databaseHooks.user.create.after`: insert `profiles` doc
  `{ auth_user_id, display_name, role, created_at, updated_at }`
- Route: `app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth.handler)` (or version-appropriate export)
- Client: `lib/auth-client.ts`

## Edge middleware guardrail (critical)

`middleware.ts` runs on **Edge**. Mongo driver **cannot** run there.

- Session check: Better Auth `getSessionCookie(request)` only (optimistic).
- Full validation: `auth.api.getSession({ headers })` in server components / route handlers.
- RBAC: coarse gate in middleware; fine-grained checks server-side.
  Document choice in the WS1 PR (role cookie vs server enforcement).

Protected examples: `/dashboard*`, `/admin*`, `/api/files*`.
Unauthed → `/login?next=<path>`.

## Forced reset (CRITICAL — never hash-migrate)

Supabase bcrypt ≠ Better Auth scrypt.

1. Import users with locked credential accounts: password `!locked:<uuid>` (see transform skill).
2. `scripts/request-password-reset.ts` calls Better Auth `requestPasswordReset`.
3. Batch sender: `scripts/send-forced-resets.ts` (dry-run, rate-limit, failure report).
4. Login banner: "Legacy user? Check your inbox to set a new password."
5. Any plan that "re-hashes on first login" is **wrong** (v3.0 bug).

Production mass send = **HUMAN GATE**.

## Verification

- Signup creates both `user` and `profiles` docs
- Email verification required before full access
- Sign-in / sign-out works
- Reset end-to-end (Resend test key or mock)
- `/api/auth/ok` → 200 when wired

## References

- `references/auth-routes.md`
- `references/forced-reset-playbook.md`
- `references/middleware-matcher.md`
