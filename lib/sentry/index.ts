import * as Sentry from '@sentry/nextjs';
import { isSentryEnabled } from './shared-options';

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { isSentryEnabled };
