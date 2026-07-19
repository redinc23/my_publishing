export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail fast at production boot when launch-critical environment is missing.
    // Validation previously only ran for `next dev` (audit finding F6).
    if (process.env.NODE_ENV === 'production') {
      const LAUNCH_CRITICAL = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ] as const;
      const missing = LAUNCH_CRITICAL.filter((name) => !process.env[name]);
      if (missing.length > 0) {
        throw new Error(
          `Missing launch-critical environment variables: ${missing.join(', ')}. ` +
            'Refusing to boot — see .env.production.example and scripts/validate-env.ts.'
        );
      }

      // Non-fatal surface: log validator warnings (format issues, optional
      // integrations) without taking down an otherwise functional deployment.
      const { validateEnvironment, printValidationResults } = await import(
        './lib/utils/env-validation'
      );
      const result = validateEnvironment();
      if (result.warnings.length > 0) {
        printValidationResults(result);
      }
    }

    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
