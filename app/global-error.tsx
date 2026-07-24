'use client';

import { useEffect } from 'react';
import { captureException } from '@/lib/sentry';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest, scope: 'global-error' });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>{error.message || 'An unexpected error occurred'}</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
