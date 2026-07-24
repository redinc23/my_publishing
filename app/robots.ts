import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/author/dashboard',
          '/author/analytics',
          '/author/projects/',
          '/author/submit',
          '/partner/dashboard',
          '/partner/arc-requests',
          '/partner/catalogs',
          '/partner/orders/',
          '/dashboard/',
          '/users/',
          '/login',
          '/register',
          '/reset-password',
          '/verify-email',
          '/reading/',
          '/library',
          '/checkout',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/author/',
          '/partner/',
          '/dashboard/',
          '/users/',
          '/login',
          '/register',
          '/reset-password',
          '/verify-email',
          '/reading/',
          '/library',
          '/checkout',
        ],
      },
      {
        userAgent: 'Bingbot',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/author/',
          '/partner/',
          '/dashboard/',
          '/users/',
          '/login',
          '/register',
          '/reset-password',
          '/verify-email',
          '/reading/',
          '/library',
          '/checkout',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
