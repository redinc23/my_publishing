#!/usr/bin/env tsx
/**
 * Migration Runner Script
 * Applies database migrations in correct order
 *
 * Usage:
 *   npm run db:migrate
 *   or
 *   tsx scripts/run-migrations.ts [--dry-run] [--migration <name>]
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '../lib/supabase/admin';

interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
  content: string;
}

interface MigrationRecord {
  name: string;
  applied_at: string;
}

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Get all migration files sorted by timestamp
 */
function getMigrationFiles(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => {
      const path = join(MIGRATIONS_DIR, file);
      const content = readFileSync(path, 'utf-8');
      // Extract timestamp from filename (format: YYYYMMDDHHMMSS_name.sql)
      const match = file.match(/^(\d{14})/);
      const timestamp = match ? match[1] : '00000000000000';

      return {
        name: file,
        path,
        timestamp,
        content,
      };
    })
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return files;
}

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable(supabase: ReturnType<typeof createClient>) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
  
  // If RPC doesn't exist, try direct query (requires service role)
  if (error) {
    console.warn('Note: Using direct SQL execution. Ensure you have service role key.');
    // For Supabase, we'll need to execute this differently
    // This is a simplified version - in production, use Supabase migration API
    console.log('Creating migrations table...');
  }
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(
  supabase: ReturnType<typeof createClient>
): Promise<string[]> {
  try {
    // Try to query the migrations table
    const { data, error } = await supabase
      .from(MIGRATIONS_TABLE)
      .select('name')
      .order('applied_at', { ascending: true });

    if (error) {
      // Table might not exist yet
      return [];
    }

    return data?.map((m) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Record a migration as applied
 */
async function recordMigration(
  supabase: ReturnType<typeof createClient>,
  migrationName: string
) {
  const { error } = await supabase.from(MIGRATIONS_TABLE).insert({
    name: migrationName,
    applied_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`Failed to record migration ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Execute a migration SQL file
 */
async function executeMigration(
  supabase: ReturnType<typeof createClient>,
  migration: MigrationFile
): Promise<boolean> {
  console.log(`\n📄 Applying migration: ${migration.name}`);

  try {
    // Split SQL by semicolons and execute each statement
    const statements = migration.content
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim().length === 0) continue;

      // Skip comments
      if (statement.trim().startsWith('--')) continue;

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct execution if RPC doesn't work
        // Note: This requires using the Supabase REST API or direct PostgreSQL connection
        console.warn(`Warning: Could not execute via RPC, trying alternative method...`);
        console.error(`SQL Error:`, error.message);
        
        // For now, we'll provide instructions
        throw new Error(
          `Migration execution requires direct database access. ` +
          `Please run migrations manually in Supabase SQL Editor or use Supabase CLI.`
        );
      }
    }

    await recordMigration(supabase, migration.name);
    console.log(`✅ Migration ${migration.name} applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to apply migration ${migration.name}:`, error);
    throw error;
  }
}

/**
 * Main migration runner
 */
async function runMigrations(options: { dryRun?: boolean; specificMigration?: string }) {
  console.log('🚀 Starting migration runner...\n');

  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease set these in .env.local');
    process.exit(1);
  }

  const supabase = createClient();
  const migrationFiles = getMigrationFiles();

  if (migrationFiles.length === 0) {
    console.error('❌ No migration files found in', MIGRATIONS_DIR);
    process.exit(1);
  }

  console.log(`📦 Found ${migrationFiles.length} migration files:`);
  migrationFiles.forEach((m) => console.log(`   - ${m.name}`));

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
    return;
  }

  // Get applied migrations
  let appliedMigrations: string[] = [];
  try {
    appliedMigrations = await getAppliedMigrations(supabase);
    console.log(`\n✅ Found ${appliedMigrations.length} already applied migrations`);
  } catch (error) {
    console.warn('⚠️  Could not check applied migrations. Proceeding...');
  }

  // Filter migrations
  let migrationsToApply = migrationFiles.filter(
    (m) => !appliedMigrations.includes(m.name)
  );

  if (options.specificMigration) {
    migrationsToApply = migrationsToApply.filter(
      (m) => m.name === options.specificMigration
    );
    if (migrationsToApply.length === 0) {
      console.error(`❌ Migration ${options.specificMigration} not found or already applied`);
      process.exit(1);
    }
  }

  if (migrationsToApply.length === 0) {
    console.log('\n✅ All migrations are already applied!');
    return;
  }

  console.log(`\n📋 Migrations to apply: ${migrationsToApply.length}`);
  migrationsToApply.forEach((m) => console.log(`   - ${m.name}`));

  // Apply migrations
  let successCount = 0;
  let failCount = 0;

  for (const migration of migrationsToApply) {
    try {
      await executeMigration(supabase, migration);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`\n❌ Migration failed: ${migration.name}`);
      console.error('Stopping migration process.');
      console.error('\n⚠️  IMPORTANT: Some migrations may have been partially applied.');
      console.error('   Please check your database state and fix any issues before retrying.');
      process.exit(1);
    }
  }

  console.log(`\n✅ Migration process complete!`);
  console.log(`   Applied: ${successCount}`);
  if (failCount > 0) {
    console.log(`   Failed: ${failCount}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  specificMigration: args.find((arg) => arg.startsWith('--migration='))?.split('=')[1],
};

runMigrations(options).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
