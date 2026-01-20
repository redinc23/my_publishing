/**
 * Health Check API
 * Production health and readiness endpoints
 * 
 * This endpoint validates:
 * - Environment variables are configured
 * - Supabase database connection (requires 'profiles' table from migrations)
 * - Supabase auth service availability
 * 
 * Migration Order (apply in this sequence):
 * 1. 20260116000000_initial_schema.sql - Creates profiles table and core schema
 * 2. 20260116000000_create_books_table.sql - Books and content tables
 * 3. 20260117000000_analytics_events.sql - Analytics tracking
 * 4. 20260117000000_storage_policies.sql - Storage bucket policies
 * 5. 20260117000001_analytics_sessions.sql - Session tracking
 * 6. 20260117000002_book_stats_materialized.sql - Materialized views
 * 7. 20260117000003_revenue_tracking.sql - Revenue tables
 * 8. 20260117000004_author_payouts.sql - Payout system
 * 9. 20260117000005_book_pricing.sql - Pricing logic
 * 10. 20260118000000_critical_fixes.sql - Bug fixes
 * 11. 20260120000006_performance_optimizations.sql - Performance indexes
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateEnvironment } from '@/lib/utils/env-validation';
import { validateStripeConfig, testStripeConnection } from '@/lib/stripe/validate-config';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime_seconds: number;
  version: string;
  checks: {
    environment: CheckResult;
    database: CheckResult;
    auth: CheckResult;
    migrations?: CheckResult;
    stripe?: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  latency_ms?: number;
  message?: string;
}

const startTime = Date.now();

function checkEnvironment(): CheckResult {
  const validation = validateEnvironment();
  
  if (!validation.valid) {
    return {
      status: 'fail',
      message: `Missing required environment variables: ${validation.missing.join(', ')}. See .env.local.example for setup instructions.`,
    };
  }
  
  if (validation.warnings.length > 0) {
    return {
      status: 'warn',
      message: `Environment warnings: ${validation.warnings.join('; ')}`,
    };
  }
  
  return { status: 'pass' };
}

async function checkDatabase(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const latency = Date.now() - start;
    
    if (error) {
      // Provide helpful error messages for common issues
      if (error.message.includes('relation "profiles" does not exist')) {
        return {
          status: 'fail',
          latency_ms: latency,
          message: 'Database migrations not applied. The "profiles" table is missing. Run migrations in order (see migration comments in this file).',
        };
      }
      if (error.message.includes('permission denied')) {
        return {
          status: 'fail',
          latency_ms: latency,
          message: 'Database permissions issue. Check Row Level Security (RLS) policies and service role key configuration.',
        };
      }
      return { status: 'fail', latency_ms: latency, message: error.message };
    }
    
    return { status: latency > 1000 ? 'warn' : 'pass', latency_ms: latency };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for common connection errors
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: 'Cannot connect to Supabase. Check NEXT_PUBLIC_SUPABASE_URL and network connectivity.',
      };
    }
    
    return { status: 'fail', latency_ms: latency, message: errorMessage };
  }
}

async function checkAuth(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    const latency = Date.now() - start;
    
    if (error) {
      // Provide helpful error messages
      if (error.message.includes('Invalid API key')) {
        return {
          status: 'fail',
          latency_ms: latency,
          message: 'Invalid Supabase API key. Check NEXT_PUBLIC_SUPABASE_ANON_KEY configuration.',
        };
      }
      return { status: 'fail', latency_ms: latency, message: error.message };
    }
    
    return { status: latency > 500 ? 'warn' : 'pass', latency_ms: latency };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: 'Cannot connect to Supabase Auth service. Check NEXT_PUBLIC_SUPABASE_URL.',
      };
    }
    
    return { status: 'fail', latency_ms: latency, message: errorMessage };
  }
}

async function checkStripe(): Promise<CheckResult> {
  const start = Date.now();
  const validation = validateStripeConfig();

  // If Stripe is not configured at all, return warn (not fail) since it's optional
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && !process.env.STRIPE_SECRET_KEY) {
    return {
      status: 'warn',
      latency_ms: Date.now() - start,
      message: 'Stripe not configured (payments will not work)',
    };
  }

  if (!validation.valid) {
    return {
      status: 'fail',
      latency_ms: Date.now() - start,
      message: `Stripe configuration errors: ${validation.errors.join('; ')}`,
    };
  }

  // Test actual API connection if secret key is available
  if (validation.secretKeyValid) {
    const connectionTest = await testStripeConnection();
    const latency = Date.now() - start;

    if (!connectionTest.success) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: `Stripe API connection failed: ${connectionTest.error}`,
      };
    }

    if (validation.warnings.length > 0) {
      return {
        status: 'warn',
        latency_ms: latency,
        message: `Stripe configured but has warnings: ${validation.warnings.join('; ')}`,
      };
    }

    return {
      status: latency > 1000 ? 'warn' : 'pass',
      latency_ms: latency,
    };
  }

  return {
    status: validation.warnings.length > 0 ? 'warn' : 'pass',
    latency_ms: Date.now() - start,
    message: validation.warnings.length > 0 ? validation.warnings.join('; ') : undefined,
  };
}

async function checkMigrations(supabase: Awaited<ReturnType<typeof createClient>>): Promise<CheckResult> {
  const start = Date.now();
  
  // Key tables that should exist after migrations
  const requiredTables = [
    'profiles',
    'books',
    'authors',
  ];
  
  // Optional tables (may not exist if some migrations haven't run)
  const optionalTables = [
    'orders',
    'analytics_events',
    'reading_sessions',
  ];
  
  try {
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    
    // Check required tables
    const requiredChecks = await Promise.all(
      requiredTables.map(async (table) => {
        const { error } = await supabase.from(table).select('id').limit(1);
        return { table, error };
      })
    );

    for (const { table, error } of requiredChecks) {
      if (error && error.message.includes('does not exist')) {
        missingRequired.push(table);
      }
    }
    
    // Check optional tables
    const optionalChecks = await Promise.all(
      optionalTables.map(async (table) => {
        const { error } = await supabase.from(table).select('id').limit(1);
        return { table, error };
      })
    );

    for (const { table, error } of optionalChecks) {
      if (error && error.message.includes('does not exist')) {
        missingOptional.push(table);
      }
    }
    
    const latency = Date.now() - start;
    
    if (missingRequired.length > 0) {
      return {
        status: 'fail',
        latency_ms: latency,
        message: `Missing required tables: ${missingRequired.join(', ')}. Run database migrations. See docs/MIGRATIONS.md for instructions.`,
      };
    }
    
    if (missingOptional.length > 0) {
      return {
        status: 'warn',
        latency_ms: latency,
        message: `Some optional tables are missing: ${missingOptional.join(', ')}. Consider running additional migrations.`,
      };
    }
    
    return { status: 'pass', latency_ms: latency };
  } catch (error) {
    const latency = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { status: 'warn', latency_ms: latency, message: `Could not verify migrations: ${errorMessage}` };
  }
}

export async function GET(): Promise<NextResponse> {
  // First check environment variables before attempting connections
  const envCheck = checkEnvironment();
  
  // If environment is not configured, return early with helpful message
  if (envCheck.status === 'fail') {
    const health: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        environment: envCheck,
        database: { status: 'fail', message: 'Skipped - environment not configured' },
        auth: { status: 'fail', message: 'Skipped - environment not configured' },
        migrations: { status: 'fail', message: 'Skipped - environment not configured' },
      },
    };
    return NextResponse.json(health, { status: 503 });
  }
  
  // Proceed with connection checks
  let supabase;
  try {
    supabase = await createClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const health: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        environment: envCheck,
        database: { status: 'fail', message: `Failed to create Supabase client: ${errorMessage}` },
        auth: { status: 'fail', message: `Failed to create Supabase client: ${errorMessage}` },
        migrations: { status: 'fail', message: `Failed to create Supabase client: ${errorMessage}` },
        stripe: { status: 'warn', message: 'Skipped - Supabase connection failed' },
      },
    };
    return NextResponse.json(health, { status: 503 });
  }
  
  const [dbCheck, authCheck, migrationsCheck, stripeCheck] = await Promise.all([
    checkDatabase(supabase),
    checkAuth(supabase),
    checkMigrations(supabase),
    checkStripe(),
  ]);

  const allPassing = 
    envCheck.status === 'pass' && 
    dbCheck.status === 'pass' && 
    authCheck.status === 'pass' &&
    migrationsCheck.status === 'pass' &&
    stripeCheck.status !== 'fail'; // Stripe is optional, so warn is OK
  
  // envCheck.status cannot be 'fail' here because we return early if it fails
  const anyFailing = 
    (dbCheck.status === 'fail') || 
    (authCheck.status === 'fail') ||
    (migrationsCheck.status === 'fail') ||
    (stripeCheck.status === 'fail');

  const health: HealthStatus = {
    status: anyFailing ? 'unhealthy' : allPassing ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    checks: { 
      environment: envCheck, 
      database: dbCheck, 
      auth: authCheck,
      migrations: migrationsCheck,
      stripe: stripeCheck,
    },
  };

  return NextResponse.json(health, { status: anyFailing ? 503 : 200 });
}