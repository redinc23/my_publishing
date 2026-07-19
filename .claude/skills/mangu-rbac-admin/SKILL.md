---
name: mangu-rbac-admin
description: This skill should be used when changing roles, admin suspend/approve flows, audit logs, portal access for reader|author|editor|admin, or enforcing RBAC outside Edge middleware for Mangu Publishers.
version: 1.0.0
---

# RBAC & Admin

## Roles

`reader` (default) | `author` | `editor` | `admin`

- Stored on Better Auth user `role` additionalField (`input: false`)
- Mirrored on `profiles.role` at create
- Fine-grained checks in server layouts/actions/route handlers — not only middleware

## Admin mutations

Wire `lib/audit.ts` `recordAudit(actorId, action, target, metadata)` for:

- Role changes
- Suspend / unsuspend
- Content approve / reject

Never silently elevate role via client input.

## Portals

Respect existing portal route groups under `app/(portals)/` and `app/admin/`.
Feature freeze: do not invent new roles or portals during Phoenix.

## References

- `references/role-matrix.md`
