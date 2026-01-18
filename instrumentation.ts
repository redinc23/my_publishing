/**
 * Next.js instrumentation file
 * This runs before the server starts and before any request is handled
 * Perfect for validating environment variables at startup
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate environment variables on server startup
    const { validateEnv } = await import('./lib/utils/env');
    
    try {
      validateEnv();
      console.log('✓ Environment variables validated successfully');
    } catch (error) {
      console.error('✗ Environment validation failed:');
      console.error(error instanceof Error ? error.message : error);
      
      // In production, exit the process to prevent startup with missing config
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
