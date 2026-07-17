import * as Sentry from '@sentry/nextjs';
import { getSharedSentryOptions, isSentryEnabled } from './lib/sentry/shared-options';

if (isSentryEnabled()) {
  Sentry.init(getSharedSentryOptions());
}
