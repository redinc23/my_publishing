# Database Migrations Guide

This document describes the database migration system and the correct order for applying migrations.

## Hosted reconciliation (P0-004) — repo inventory refreshed 2026-07-20

| Field       | Value                                                                                                                                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project     | `mangu-publishers` / `tkzvikozrcynhwsqtkqp` (us-west-1)                                                                                                                                                                                        |
| Source      | Supabase MCP `list_migrations` + `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version`                                                                                                                            |
| Local files | **33** in `supabase/migrations/` (tip: `20260719042627_listening_progress_schema_reconciliation`)                                                                                                                                               |
| Hosted rows | **25** at the last recorded export (2026-07-18). Re-export **PENDING** (owner) — see classification below                                                                                                                                       |
| Diff        | 2026-07-18 export: exact match (25/25; no pending; no remote-only). Since then 8 migrations (`20260719005815` … `20260719042627`) landed repo-side. `20260719005815` records in its header that it was applied to production via Supabase MCP on 2026-07-19 (notes in PR #251) — confirm via fresh export |
| PR #184     | **Closed unmerged 2026-07-19** — superseded; no reorder needed, history is strictly ordered and forward-fix only. Filenames remain frozen                                                                                                       |

### Classification

| Class                                                 | Versions                                                                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Applied (repo ∩ hosted)                               | 25 versions up to `20260717114300_order_items_select_own` (per the 2026-07-18 export)                                                                                  |
| Pending hosted confirmation (repo-side since 2026-07-19) | `20260719005815`, `20260719014244`, `20260719014349`, `20260719021959`, `20260719042247`, `20260719042254`, `20260719042623`, `20260719042627` (8 files)              |
| Remote-only (hosted only)                             | _(none in the 2026-07-18 export; re-export PENDING)_                                                                                                                   |

### `order_items` SELECT policy (P0-015 schema verify)

Policy recorded on 2026-07-18 as present hosted and matching repo intent (owner re-confirmation PENDING — see #199):

- name: `Users can view own order items`
- cmd: `SELECT` (`r`)
- USING: `order_id IN (SELECT orders.id FROM orders WHERE orders.user_id IN (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid()))`

The repo migration now guards the create with `DROP POLICY IF EXISTS` (Postgres has no
`CREATE POLICY IF NOT EXISTS`), matching the convention used across the `20260719*`
migrations. Same policy name and definition, so environments that already applied it
converge to the identical state. `scripts/verify-rls.ts` now includes an anonymous
`order_items` denial check; live entitled nested-read / authenticated `verify-rls`
confirmation remains hosted-side (Phase 12/13).

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

16. **20260708074716_enable_rls_on_exposed_tables.sql**
    - Enables RLS on exposed tables
    - **Dependencies**: prior public tables

17. **20260708074819_harden_definer_views_and_rpcs.sql**
    - Hardens SECURITY DEFINER views/RPCs
    - **Dependencies**: prior schema

18. **20260717114020_protect_profiles_role.sql**
    - Protects `profiles.role` from client escalation
    - **Dependencies**: `profiles`

19. **20260717114047_tighten_analytics_sessions_rls.sql**
    - Tightens analytics session RLS
    - **Dependencies**: `analytics_sessions`

20. **20260717114057_public_read_authors.sql**
    - Public read policy for authors
    - **Dependencies**: `authors`

21. **20260717114115_fix_review_stats_trigger.sql**
    - Fixes review stats trigger
    - **Dependencies**: social/reviews

22. **20260717114221_revoke_anon_update_reading_progress.sql**
    - Revokes anon update on reading progress
    - **Dependencies**: `reading_progress`

23. **20260717114300_order_items_select_own.sql**
    - Buyer SELECT on own `order_items` (P0-015); idempotent via `DROP POLICY IF EXISTS` + `CREATE POLICY`
    - **Dependencies**: `orders`, `order_items`, `profiles`

24. **20260719005815_security_hardening_rls_exec.sql**
    - Revokes `book_stats_summary` from anon/authenticated; repairs dead `books.author_id = auth.uid()` policies (correct join: books → authors → profiles); column-level `authors` grants (hides `royalty_rate`); pins `search_path` on definer functions; restricts `get_recommendations` to own user; restores `engagement_events` insert policy
    - **Dependencies**: prior books/authors/analytics schema

25. **20260719014244_review_enhancements.sql**
    - `reviews.verified_purchase` + author-reply columns; `review_votes` table guard; RLS for `reviews`/`review_votes`; `helpful_count` sync trigger
    - **Dependencies**: `reviews` (social_features)

26. **20260719014349_resonance_engine_phase2.sql**
    - Adds `impression`/`click` engagement event types; dedupes + unique-indexes `resonance_vectors` per book; `match_resonance_vector` RPC (authenticated/service_role)
    - **Dependencies**: `engagement_events`, `resonance_vectors`

27. **20260719021959_email_preferences.sql**
    - `email_preferences` table + RLS (users manage only their own rows; no DELETE policy)
    - **Dependencies**: `auth.users`, `update_updated_at_column()`

28. **20260719042247_reader_engagement_schema_reconciliation.sql**
    - Records out-of-band production schema for `bookmarks`, `highlights`, `wishlist`, `author_follows` + RLS and grants
    - **Dependencies**: `books`, `authors`, `auth.users`

29. **20260719042254_security_advisor_hardening.sql**
    - `security_invoker` on `book_overview`/`public_profiles` views; pins remaining function `search_path`s; restricts `engagement_events` inserts to service_role; drops broad storage listing policy
    - **Dependencies**: prior schema (incl. #24–#28)

30. **20260719042623_newsletter_subscribers_schema_reconciliation.sql**
    - `newsletter_subscribers` table (double opt-in), service-role-only access
    - **Dependencies**: `update_updated_at_column()`

31. **20260719042627_listening_progress_schema_reconciliation.sql**
    - `listening_progress` table (composite PK per listener/book) + RLS mirroring the `reading_progress` ownership pattern
    - **Dependencies**: `profiles`, `books`

32. **20260724000000_expand_manuscript_workflow.sql**
    - Reviewer assignment + workflow timestamp columns, `version_number`, `author_notes`/`internal_notes`, canonical `submitted_at` (backfilled)
    - Replaces the manuscript status constraint with the canonical 8-status set; legacy `published` rows remapped to `converted_to_book`
    - **Dependencies**: `manuscripts`, `profiles`

33. **20260724000001_create_manuscript_status_history.sql**
    - `manuscript_status_history` (immutable, trigger-written) + automatic status-change trigger + backfill
    - **Dependencies**: 20260724000000

34. **20260724000002_create_manuscript_reviews.sql**
    - `manuscript_reviews` with decision constraint, review rounds, author feedback vs. internal notes
    - **Dependencies**: 20260724000000, `update_updated_at_column()`

35. **20260724000003_add_manuscript_book_link.sql**
    - `manuscripts.book_id` + `converted_by_profile_id`, conversion consistency check, one-book-per-manuscript partial unique index
    - **Dependencies**: 20260724000000, `books`

36. **20260724000004_harden_manuscript_rls.sql**
    - Drops the broad `FOR ALL` author policy; separated per-operation policies; `current_profile_id()` / `current_user_is_admin()` helpers (profiles.role, not JWT); workflow-field protection trigger; author-safe `author_manuscript_status_history` and `author_manuscript_feedback` views
    - **Dependencies**: 20260724000000–20260724000003

37. **20260724000005_harden_manuscript_storage.sql**
    - Manuscript bucket stays private / 100 MiB / 4 MIME types; per-user path isolation (`<auth-user-id>/<manuscript-id>/<version>/<file>`); draft-only deletion; authoritative admin policy; placeholder virus-scan trigger replaced by `scan_status=pending` tagging
    - **Dependencies**: 20260724000004 (helper functions), 20260117000006

38. **20260724000006_add_manuscript_indexes.sql**
    - Workflow indexes for admin queue, reviewer queue, author project list, history timeline, review rounds
    - **Dependencies**: 20260724000001, 20260724000002

Also present (early sequence): **20260116000001_create_books_table.sql**, **20260117000007_storage_policies.sql** — both applied hosted; keep filenames stable. (`20260117000007` is a recorded `SELECT 1;` stub so remote `supabase_migrations` history matches the local directory.)

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

Hosted Supabase tracks applied migrations in `supabase_migrations.schema_migrations`:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

(Some older tooling referred to a plain `schema_migrations` table — on this project the authoritative table is under the `supabase_migrations` schema.)
