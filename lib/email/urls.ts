/**
 * URL helpers for transactional email templates and triggers.
 *
 * Templates are rendered outside a request context (webhooks, server actions,
 * cron), so links must be absolute and derived from env configuration rather
 * than the incoming request.
 */

/** Absolute site origin for links rendered into emails. */
export function getEmailBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const vercelUrl =
    process.env.VERCEL_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelUrl) {
    const normalizedVercelUrl = vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${normalizedVercelUrl}`;
  }

  // Matches the fallback used by lib/email/templates.tsx and the register flow.
  return 'http://localhost:3001';
}

/** Absolute URL for a site path, safe to embed in an email. */
export function getEmailUrl(path: string): string {
  return `${getEmailBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
