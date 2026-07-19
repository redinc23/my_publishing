#!/usr/bin/env tsx
/**
 * Environment Variable Validation Script
 * Run this before starting the dev server to ensure all required env vars are set.
 *
 * Usage:
 *   npm run validate-env                       # local dev (.env.local)
 *   npm run validate-env -- --production       # production-shaped config (P0-016)
 *   npm run validate-env:production            # same as above
 *   tsx scripts/validate-env.ts --production [--file .env.production]
 *
 * Production mode validates the production-shaped config against the variable
 * list in .env.production.example (ADR-001: canonical store is Vercel
 * Production env; legacy Cloud Run path mounts the same names from GCP Secret
 * Manager — see docs/SECRET_INVENTORY.md). It fails closed (exit 1) when a
 * required variable is missing/placeholder-shaped, when Stripe live/test modes
 * are inconsistent, or when USE_MOCKS / SKIP_EMAILS are enabled (both must be
 * ABSENT in production). No secret values are ever printed (CCR-009).
 */

import { validateEnvironment, printValidationResults } from '../lib/utils/env-validation';

const PRODUCTION_MODE =
  process.argv.includes('--production') || process.env.ENV_TARGET === 'production';

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

// Minimal .env file parser (dotenv is not a dependency). Handles KEY=value,
// optional quotes, and `#` comments. Never throws on a missing file.
function parseEnvFile(filePath) {
  const out = {};
  let text;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return out;
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

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

// Load the production-shaped env: real process env wins; values from the
// target file fill the gaps (mirrors how Vercel/Cloud Run inject env).
function loadProductionEnvironment(filePath) {
  process.env.NODE_ENV = 'production';
  const fromFile = parseEnvFile(filePath);
  for (const [key, value] of Object.entries(fromFile)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return fromFile;
}

// True when a value still looks like an .example placeholder (fail-closed).
function looksPlaceholder(value) {
  return /\.\.\.$/.test(value) || /your[-_]/i.test(value) || /xxxxx/i.test(value) ||
    /<[^>]+>/.test(value);
}

/**
 * P0-016 production-shaped validation. Returns { errors, warnings }.
 * The var list mirrors .env.production.example; formats are checked by prefix
 * only — values are never logged.
 */
function validateProductionShape(filePath) {
  const errors = [];
  const warnings = [];

  const required = [
    ['NEXT_PUBLIC_SUPABASE_URL', (v) => v.startsWith('https://') && v.includes('.supabase.co'), 'https://*.supabase.co'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', (v) => v.length >= 20, 'Supabase anon JWT'],
    ['SUPABASE_SERVICE_ROLE_KEY', (v) => v.length >= 20, 'Supabase service-role JWT'],
    ['MONGODB_URI', (v) => v.startsWith('mongodb://') || v.startsWith('mongodb+srv://'), 'mongodb+srv://… (ADR-002)'],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', (v) => v.startsWith('pk_'), 'pk_live_… / pk_test_…'],
    ['STRIPE_SECRET_KEY', (v) => v.startsWith('sk_'), 'sk_live_… / sk_test_…'],
    ['STRIPE_WEBHOOK_SECRET', (v) => v.startsWith('whsec_'), 'whsec_…'],
    ['NEXT_PUBLIC_SITE_URL', (v) => v.startsWith('https://'), 'https://…'],
    ['UPSTASH_REDIS_REST_URL', (v) => v.startsWith('https://'), 'https://…upstash.io'],
    ['UPSTASH_REDIS_REST_TOKEN', (v) => v.length >= 10, 'Upstash REST token'],
  ];

  for (const [name, check, hint] of required) {
    const value = process.env[name];
    if (!value) {
      errors.push(`${name}: missing (required in production — expected ${hint})`);
      continue;
    }
    if (looksPlaceholder(value)) {
      errors.push(`${name}: placeholder-shaped value (expected ${hint})`);
      continue;
    }
    if (!check(value)) {
      errors.push(`${name}: invalid format (expected ${hint})`);
    }
  }

  // Optional integrations: validate format only when present.
  const optional = [
    ['OPENAI_API_KEY', (v) => v.startsWith('sk-'), 'sk-…'],
    ['RESEND_API_KEY', (v) => v.startsWith('re_'), 're_…'],
    ['MONGODB_DB', (v) => v.length > 0, 'database name'],
  ];
  for (const [name, check, hint] of optional) {
    const value = process.env[name];
    if (value && !check(value)) {
      warnings.push(`${name}: present but unusual format (expected ${hint})`);
    }
  }

  // P0-016 / CCR: USE_MOCKS and SKIP_EMAILS must be ABSENT in production.
  for (const name of ['USE_MOCKS', 'SKIP_EMAILS']) {
    const value = process.env[name];
    if (value === undefined) continue;
    if (value === 'true') {
      errors.push(`${name}=true is FORBIDDEN in production — remove it from the production env`);
    } else {
      warnings.push(`${name} is set ('${value}') — it must be ABSENT in production; remove it`);
    }
  }

  // Stripe live/test mode consistency across publishable + secret keys.
  const modeOf = (v) => {
    if (!v) return undefined;
    if (/_live_/.test(v)) return 'live';
    if (/_test_/.test(v)) return 'test';
    return 'unknown';
  };
  const pkMode = modeOf(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  const skMode = modeOf(process.env.STRIPE_SECRET_KEY);
  if (pkMode && skMode && (pkMode === 'unknown' || skMode === 'unknown')) {
    warnings.push('Stripe key mode not recognizable (expected pk_live_/sk_live_ or pk_test_/sk_test_)');
  } else if (pkMode && skMode && pkMode !== skMode) {
    errors.push(
      `Stripe mode mismatch: publishable key is ${pkMode} but secret key is ${skMode} — use one account+mode (P0-016)`
    );
  }
  if (pkMode === 'test') {
    warnings.push('Stripe TEST mode keys in a production-shaped config — switch to live keys before launch');
  }

  return { errors, warnings, filePath };
}

function main() {
  if (PRODUCTION_MODE) {
    const filePath = argValue('--file') || '.env.production';
    console.log('🔍 Validating PRODUCTION-shaped environment…');
    console.log(`   Target file: ${filePath} (process env takes precedence)\n`);

    const fromFile = loadProductionEnvironment(filePath);
    if (argValue('--file') && Object.keys(fromFile).length === 0) {
      console.warn(`   ⚠️  No variables read from ${filePath} — validating process env only.\n`);
    }

    // Base checks (Supabase trio, pair completeness, format validators).
    const base = validateEnvironment();
    printValidationResults(base);

    const { errors, warnings } = validateProductionShape(filePath);
    for (const name of base.missing) {
      if (!errors.some((e) => e.startsWith(`${name}:`))) {
        errors.push(`${name}: missing (required)`);
      }
    }
    warnings.push(...base.warnings);

    if (warnings.length > 0) {
      console.warn('\n⚠️  Production config warnings:');
      for (const w of warnings) console.warn(`   - ${w}`);
    }
    if (errors.length > 0) {
      console.error('\n❌ Production environment validation FAILED:');
      for (const e of errors) console.error(`   - ${e}`);
      console.error('\nFix the production env (Vercel Production variables per ADR-001;');
      console.error('legacy Cloud Run: GCP Secret Manager — see docs/SECRET_INVENTORY.md).');
      console.error('USE_MOCKS and SKIP_EMAILS must be ABSENT in production.\n');
      process.exit(1);
    }

    console.log('\n✅ Production-shaped environment validation passed!');
    console.log('   Record the masked env-name export in docs/OPERATOR_QA_LOG.md (P0-016).\n');
    process.exit(0);
  }

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
