export interface SharedSentryOptions {
  dsn?: string;
  enabled: boolean;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  debug?: boolean;
}

export function getSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
}

export function getSentryRelease(): string | undefined {
  return (
    process.env.SENTRY_RELEASE ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    undefined
  );
}

export function getSharedSentryOptions(): SharedSentryOptions {
  const dsn = getSentryDsn();

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: getSentryRelease(),
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    debug: process.env.SENTRY_DEBUG === 'true',
  };
}
