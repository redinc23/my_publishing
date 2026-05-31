#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 * Run this before starting the dev server to ensure all required env vars are set
 *
 * Usage:
 *   npm run validate-env
 *   or
 *   tsx scripts/validate-env.ts
 */

import { validateEnvironment, printValidationResults } from '../lib/utils/env-validation';

function loadEnvironmentFiles() {
  // Prefer Next's env loader so validation matches `next dev` behavior.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadEnvConfig } = require('@next/env');
    loadEnvConfig(process.cwd());
    return;
  } catch {
    // Fall through to dotenv as a best-effort fallback.
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: '.env.local' });
  } catch {
    // No supported env loader available; continue with existing process env.
  }
}

function main() {
  console.log('🔍 Validating environment variables...\n');

  loadEnvironmentFiles();

  const result = validateEnvironment();
  printValidationResults(result);

  if (!result.valid) {
    console.error('\n❌ Environment validation failed!');
    console.error('Please set the missing environment variables in .env.local');
    console.error('See .env.local.example for reference.\n');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Some optional variables have warnings, but the app can still run.');
    console.warn('Review the warnings above and fix them if needed.\n');
  }

  console.log('✅ Environment validation passed!\n');
  process.exit(0);
}

main();
