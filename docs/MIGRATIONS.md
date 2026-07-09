# Database Migrations Guide

This document describes the database migration system and the correct order for applying migrations.

## Migration Order

Migrations **must be applied in this exact order** due to dependencies between tables and features:

1. **20260116000000_initial_schema.sql**
   - Creates `profiles` table (required for health check)
   - Creates `authors` table
   - Creates `books`, `book_content`, `genres`, and related core tables
   - Sets up core schema and indexes
   - **Dependencies**: None (foundation)

2. **20260117000000_analytics_events.sql**
   - Creates `analytics_events` table
   - Creates `engagement_events` table
   - Sets up analytics tracking
   - **Dependencies**: `books`, `profiles`

3. **20260117000001_analytics_sessions.sql**
   - Creates `analytics_sessions` table
   - Creates session tracking functionality
   - **Dependencies**: `analytics_events`

4. **20260117000002_book_stats_materialized.sql**
   - Creates materialized views for book statistics
   - Creates refresh functions
   - **Dependencies**: `books`, `analytics_events`

5. **20260117000003_revenue_tracking.sql**
   - Creates `orders` table
   - Creates `revenue_events` table
   - Sets up payment tracking
   - **Dependencies**: `books`, `profiles`

6. **20260117000004_author_payouts.sql**
   - Creates `payouts` table
   - Creates payout calculation functions
   - **Dependencies**: `orders`, `authors`, `books`

7. **20260117000005_book_pricing.sql**
   - Creates pricing tables and logic
   - Sets up discount system
   - **Dependencies**: `books`

8. **20260117000006_storage_policies.sql**
   - Creates storage buckets
   - Sets up Row Level Security (RLS) policies for storage
   - **Dependencies**: `profiles`, `books`

9. **20260118000000_critical_fixes.sql**
    - Applies bug fixes
    - Updates constraints and indexes
    - **Dependencies**: All previous migrations

10. **20260120000006_performance_optimizations.sql**
    - Adds performance indexes
    - Optimizes queries
    - **Dependencies**: All previous migrations

11. **20260121000000_profile_trigger.sql**
    - Auto-creates profile on user signup
    - **Dependencies**: `profiles`

12. **20260122000000_social_features.sql**
    - Social tables (reviews, follows, etc.)
    - **Dependencies**: `profiles`, `books`

13. **20260619124500_add_content_type_to_books.sql**
    - Adds `content_type` column, constraint, and index to `books`
    - **Dependencies**: `books`

14. **20260619162409_add_content_type.sql**
    - Later duplicate of the `content_type` change (see note below)
    - **Dependencies**: `books`

15. **20260619170000_add_retailer_urls.sql**
    - Adds retailer URL fields to `books`
    - **Dependencies**: `books`

> **Note — duplicate `content_type` migrations (Fix C3):** `20260619124500` and
> `20260619162409` intentionally overlap. Both are written with
> `IF NOT EXISTS` / conditional guards, so each is idempotent and applying both
> (in either a fresh or partially-migrated database) is safe and results in the
> same schema. Do **not** delete either file — removing one would break
> `schema_migrations` history on environments where it was already recorded.

### Bundle for SQL Editor

```bash
./scripts/bundle-migrations.sh > /tmp/mangu-all-migrations.sql
```

Paste into Supabase SQL Editor in one session, or run file-by-file in order.

## Applying Migrations

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file content in order
4. Execute each migration one by one
5. Verify each migration succeeded before proceeding

### Option 2: Using Migration Runner Script

```bash
# Apply all pending migrations
npm run db:migrate

# Dry run (see what would be applied)
npm run db:migrate -- --dry-run

# Apply specific migration
npm run db:migrate -- --migration=20260116000000_initial_schema.sql
```

**Note**: `npm run db:migrate` requires a Supabase `exec_sql` RPC (not enabled on most hosted projects). Use **Option 1** (SQL Editor) or `./scripts/bundle-migrations.sh` instead.

### Option 3: Using Supabase CLI

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Verifying Migrations

After applying migrations, verify:

1. **Health Check**: Visit `/api/health` - should return "healthy" status
2. **Tables Exist**: Check that all expected tables exist in Supabase dashboard
3. **RLS Policies**: Verify Row Level Security policies are active
4. **Functions**: Check that database functions were created successfully

## Troubleshooting

### Migration Fails with "relation already exists"

- A migration was partially applied
- Check which tables/functions already exist
- You may need to manually fix the migration or rollback

### Migration Fails with "permission denied"

- Ensure you're using the service role key (not anon key)
- Check that RLS policies allow the operation
- Verify your Supabase project permissions

### Migration Fails with "foreign key constraint"

- A dependency migration wasn't applied
- Check migration order
- Apply missing dependencies first

## Rollback

Currently, there's no automatic rollback mechanism. To rollback:

1. Identify which migration to rollback to
2. Manually reverse the changes in Supabase SQL Editor
3. Update the `schema_migrations` table to remove the migration record

## Migration Tracking

Migrations are tracked in the `schema_migrations` table:

```sql
SELECT * FROM schema_migrations ORDER BY applied_at;
```

This table is automatically created by the migration runner script.
