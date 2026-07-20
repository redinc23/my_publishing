/**
 * Canonical Mangu roles (Phoenix D9 / live Postgres CHECK).
 * Not `editor` — partner is first-class for the partner portal.
 */

export const MANGU_ROLES = ['reader', 'author', 'partner', 'admin'] as const;

export type ManguRole = (typeof MANGU_ROLES)[number];

export const DEFAULT_MANGU_ROLE: ManguRole = 'reader';

/** Cookie used for coarse Edge RBAC when AUTH_PROVIDER=better-auth (optimistic). */
export const MANGU_ROLE_COOKIE = 'mangu-role';

export function isManguRole(value: unknown): value is ManguRole {
  return typeof value === 'string' && (MANGU_ROLES as readonly string[]).includes(value);
}

export function normalizeManguRole(value: unknown): ManguRole {
  return isManguRole(value) ? value : DEFAULT_MANGU_ROLE;
}

/** Authors and admins may create/update catalog books via API. */
export function canMutateCatalog(role: ManguRole): boolean {
  return role === 'admin' || role === 'author';
}
