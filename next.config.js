/** @type {import('next').NextConfig} */

// PERF-PHASE2-8 — Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Public client configuration must exist while Next.js prerenders pages on Vercel.
// These fallbacks are intentionally limited to browser-safe values. Never add
// service-role, Stripe secret, webhook, Redis, or other private credentials here.
const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tkzvikozrcynhwsqtkqp.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrenZpa296cmN5bmh3c3F0a3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzU4MzYsImV4cCI6MjA5NDIxMTgzNn0.mf8wC6KEzkw9K2d_H9VzG9rzFPSPWpgQUL0b5kMruDI',
  NEXT_PUBLIC_SITE_URL:
    process.env.NEXT_PUBLIC_SITE_URL || 'https://mypublishing-redinc23s-projects.vercel.app',
};

// Build a Content-Security-Policy that covers all required third-party origins.
// 'unsafe-inline' / 'unsafe-eval' are required by Next.js 14 until nonce-based
// CSP is fully wired in; tighten further by replacing them with nonces once the
// application supports it.
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inline scripts and client-side hydration require 'unsafe-inline'.
  // Stripe JS also needs to load from js.stripe.com.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
  // Tailwind/CSS-in-JS produces inline styles at runtime.
  "style-src 'self' 'unsafe-inline'",
  // Images come from self, Supabase Storage, Stripe, and placeholder services.
  "img-src 'self' data: blob: https://*.supabase.co https://picsum.photos https://images.unsplash.com https://q.stripe.com",
  // API calls go to Supabase (REST + Realtime WS) and Stripe.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://q.stripe.com https://*.sentry.io https://*.ingest.sentry.io",
  // Stripe embeds iframes for secure card input.
  'frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com',
  "font-src 'self'",
  // Disallow plugins and object embeds entirely.
  "object-src 'none'",
  // Restrict <base> tag hijacking.
  "base-uri 'self'",
  // Only allow forms to POST to the same origin.
  "form-action 'self'",
  // Prevent this page from being embedded in a foreign frame (replaces X-Frame-Options).
  "frame-ancestors 'none'",
  // Block mixed content.
  'upgrade-insecure-requests',
].join('; ');

const nextConfig = {
  env: publicEnv,
  output: process.platform === 'win32' ? undefined : 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // CSP supersedes X-Frame-Options; keep both for legacy browser coverage.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // X-XSS-Protection is deprecated in modern browsers but harmless for older ones.
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // Prevent popups from retaining opener access (protects OAuth flows).
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // Restrict how this page's resources can be embedded by cross-origin pages.
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb', // PERF-PHASE2-9 — Tighten from 50mb to 1mb
    },
  },
};

// PERF-PHASE2-8
const { withSentryConfig } = require('@sentry/nextjs');

const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
};

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), sentryWebpackPluginOptions);
