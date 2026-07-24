/**
 * Server-only tripwire (zero-dependency equivalent of the `server-only` package).
 *
 * Import this module from any file that constructs clients with server-only
 * credentials (service-role keys, Stripe secrets, webhook secrets, Redis tokens).
 * If the module graph ever pulls one of those files into a browser bundle, this
 * throws at module-evaluation time and breaks the build/hydration loudly instead
 * of silently shipping credentials to clients.
 */
if (typeof window !== 'undefined') {
  throw new Error(
    'Server-only module imported into a browser bundle. ' +
      'Move credential-bearing imports behind a server boundary (route handler, server action, or RSC).'
  );
}

export {};
