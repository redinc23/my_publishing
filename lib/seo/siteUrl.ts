export function getSiteUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    const normalizedVercelUrl = vercelUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `https://${normalizedVercelUrl}`;
  }

  return 'http://localhost:3000';
}
