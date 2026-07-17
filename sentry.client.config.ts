import * as Sentry from '@sentry/nextjs';
import { getSharedSentryOptions, isSentryEnabled } from './lib/sentry/shared-options';

if (isSentryEnabled()) {
  Sentry.init({
    ...getSharedSentryOptions(),
    integrations: [Sentry.replayIntegration()],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
