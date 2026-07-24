/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(process.cwd(), 'supabase/migrations');
const read = (f: string) => readFileSync(join(dir, f), 'utf8');

const workflow = read('20260724000000_expand_manuscript_workflow.sql');
const history = read('20260724000001_create_manuscript_status_history.sql');
const reviews = read('20260724000002_create_manuscript_reviews.sql');
const bookLink = read('20260724000003_add_manuscript_book_link.sql');
const rls = read('20260724000004_harden_manuscript_rls.sql');
const storage = read('20260724000005_harden_manuscript_storage.sql');
const indexes = read('20260724000006_add_manuscript_indexes.sql');
const stripComments = (x: string) => x.replace(/^\s*--.*$/gm, '');

const CANONICAL_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'revisions_requested',
  'accepted',
  'rejected',
  'withdrawn',
  'converted_to_book',
];

describe('manuscript workflow migration (20260724000000)', () => {
  it('contains all eight canonical statuses in the status constraint', () => {
    const constraint = workflow.match(
      /manuscripts_status_check[\s\S]*?\)\s*\);/i
    )?.[0] as string;
    expect(constraint).toBeTruthy();
    for (const s of CANONICAL_STATUSES) {
      expect(constraint).toContain(`'${s}'`);
    }
  });

  it('does not retain published as a manuscript status', () => {
    const constraint = workflow.match(
      /manuscripts_status_check[\s\S]*?\)\s*\);/i
    )?.[0] as string;
    expect(constraint).not.toMatch(/'published'/);
  });

  it('remaps legacy published rows to converted_to_book before the swap', () => {
    expect(workflow).toMatch(
      /UPDATE manuscripts\s+SET status = 'converted_to_book'\s+WHERE status = 'published'/i
    );
  });

  it('backfills submitted_at from submission_date/created_at', () => {
    expect(workflow).toMatch(
      /SET submitted_at = COALESCE\(submission_date, created_at\)/i
    );
  });

  it('adds new columns idempotently', () => {
    for (const col of [
      'assigned_reviewer_id',
      'assigned_at',
      'review_started_at',
      'decision_at',
      'withdrawn_at',
      'converted_at',
      'author_notes',
      'internal_notes',
      'version_number',
      'submitted_at',
    ]) {
      expect(workflow).toMatch(
        new RegExp(`ADD COLUMN IF NOT EXISTS ${col}`, 'i')
      );
    }
  });

  it('references profiles(id), not auth.users, for the reviewer FK', () => {
    expect(workflow).toMatch(/REFERENCES profiles\(id\)/i);
    expect(workflow).not.toMatch(/REFERENCES auth\.users/i);
  });

  it('adds the data-validation constraints', () => {
    for (const name of [
      'manuscripts_word_count_positive',
      'manuscripts_version_number_positive',
      'manuscripts_title_not_blank',
      'manuscripts_genre_not_blank',
      'manuscripts_synopsis_length',
      'manuscripts_target_audience_length',
    ]) {
      expect(workflow).toContain(name);
    }
  });
});

describe('manuscript status history migration (20260724000001)', () => {
  it('creates the history table with required columns', () => {
    expect(history).toMatch(/CREATE TABLE IF NOT EXISTS manuscript_status_history/i);
    for (const col of [
      'manuscript_id',
      'from_status',
      'to_status',
      'changed_by_profile_id',
      'reason',
      'internal_reason',
      'metadata',
      'created_at',
    ]) {
      expect(history).toContain(col);
    }
  });

  it('makes history immutable via BEFORE UPDATE OR DELETE trigger', () => {
    expect(history).toMatch(/prevent_manuscript_history_mutation/);
    expect(history).toMatch(/BEFORE UPDATE OR DELETE ON manuscript_status_history/i);
    expect(history).toMatch(/immutable/i);
  });

  it('records status changes automatically', () => {
    expect(history).toMatch(/record_manuscript_status_change/);
    expect(history).toMatch(/AFTER INSERT OR UPDATE OF status ON manuscripts/i);
  });

  it('backfills one initial history row per existing manuscript', () => {
    expect(history).toMatch(/INSERT INTO manuscript_status_history[\s\S]*FROM manuscripts m\s+WHERE NOT EXISTS/i);
  });

  it('enables RLS and blocks client writes', () => {
    expect(history).toMatch(/ALTER TABLE manuscript_status_history ENABLE ROW LEVEL SECURITY/i);
    expect(history).toMatch(/REVOKE INSERT, UPDATE, DELETE ON manuscript_status_history FROM authenticated/i);
  });
});

describe('manuscript reviews migration (20260724000002)', () => {
  it('creates the reviews table with decision constraint', () => {
    expect(reviews).toMatch(/CREATE TABLE IF NOT EXISTS manuscript_reviews/i);
    for (const d of ['pending', 'changes_requested', 'accepted', 'rejected']) {
      expect(reviews).toContain(`'${d}'`);
    }
  });

  it('has manuscript CASCADE and reviewer RESTRICT foreign keys', () => {
    expect(reviews).toMatch(/REFERENCES manuscripts\(id\) ON DELETE CASCADE/i);
    expect(reviews).toMatch(/REFERENCES profiles\(id\) ON DELETE RESTRICT/i);
  });

  it('prevents duplicate review rounds and attaches updated_at trigger', () => {
    expect(reviews).toMatch(/UNIQUE \(manuscript_id, review_round\)/i);
    expect(reviews).toMatch(/EXECUTE FUNCTION update_updated_at_column\(\)/i);
  });
});

describe('manuscript book link migration (20260724000003)', () => {
  it('adds book link columns and FKs with SET NULL behavior', () => {
    expect(bookLink).toMatch(/ADD COLUMN IF NOT EXISTS book_id UUID/i);
    expect(bookLink).toMatch(/ADD COLUMN IF NOT EXISTS converted_by_profile_id UUID/i);
    expect(bookLink).toMatch(/REFERENCES books\(id\) ON DELETE SET NULL/i);
  });

  it('enforces at most one book per manuscript via partial unique index', () => {
    expect(bookLink).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS manuscripts_book_id_unique[\s\S]*WHERE book_id IS NOT NULL/i
    );
  });

  it('enforces conversion field consistency', () => {
    expect(bookLink).toContain('manuscripts_conversion_consistency');
    expect(bookLink).toMatch(/status = 'converted_to_book'/);
  });
});

describe('manuscript RLS migration (20260724000004)', () => {
  it('drops the unsafe FOR ALL author policy', () => {
    expect(rls).toMatch(/DROP POLICY IF EXISTS "Authors can manage own manuscripts" ON manuscripts/i);
  });

  it('uses profiles.role for admin checks, never JWT metadata', () => {
    expect(rls).toMatch(/current_user_is_admin/);
    expect(rls).toMatch(/role = 'admin'/);
    expect(stripComments(rls)).not.toMatch(/auth\.jwt\(\)/);
  });

  it('locks search_path on SECURITY DEFINER helper functions', () => {
    const fns = rls.match(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/g) ?? [];
    expect(fns.length).toBeGreaterThanOrEqual(2);
    for (const fn of fns) {
      if (/SECURITY DEFINER/i.test(fn)) {
        expect(fn).toMatch(/SET search_path = public/i);
      }
    }
  });

  it('defines separated per-operation policies', () => {
    for (const p of [
      'manuscripts_select_own_or_admin',
      'manuscripts_insert_own_drafts',
      'manuscripts_update_own_editable',
      'manuscripts_delete_own_drafts',
      'manuscripts_admin_all',
    ]) {
      expect(rls).toContain(p);
    }
  });

  it('adds the workflow-field protection trigger with legal author transitions only', () => {
    expect(rls).toMatch(/protect_manuscript_workflow_fields/);
    expect(rls).toMatch(/BEFORE UPDATE ON manuscripts/i);
    expect(rls).toMatch(/'draft' AND NEW\.status = 'submitted'/);
    expect(rls).toMatch(/'revisions_requested' AND NEW\.status = 'submitted'/);
    expect(rls).toMatch(/'submitted' AND NEW\.status = 'withdrawn'/);
  });

  it('exposes author-safe views without internal fields', () => {
    const historyView = rls.match(
      /CREATE OR REPLACE VIEW author_manuscript_status_history[\s\S]*?;/
    )?.[0] as string;
    expect(historyView).toBeTruthy();
    expect(historyView).not.toMatch(/internal_reason/);
    expect(historyView).not.toMatch(/\bmetadata\b/);
    expect(historyView).not.toMatch(/changed_by_profile_id/);

    const feedbackView = rls.match(
      /CREATE OR REPLACE VIEW author_manuscript_feedback[\s\S]*?GRANT SELECT ON author_manuscript_feedback/
    )?.[0] as string;
    expect(feedbackView).toBeTruthy();
    expect(feedbackView).not.toMatch(/internal_notes/);
    expect(feedbackView).not.toMatch(/reviewer_profile_id,/);
  });
});

describe('manuscript storage migration (20260724000005)', () => {
  it('keeps the bucket private with the 100 MiB limit', () => {
    expect(storage).toMatch(/public = false/i);
    expect(storage).toContain('104857600');
  });

  it('keeps exactly the four supported MIME types', () => {
    for (const mime of [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]) {
      expect(storage).toContain(mime);
    }
    expect(storage).not.toMatch(/application\/epub/);
  });

  it('removes the JWT-metadata admin policy', () => {
    expect(storage).toMatch(/DROP POLICY IF EXISTS "Admins have full access to all files"/i);
    expect(stripComments(storage)).not.toMatch(/auth\.jwt\(\)/);
  });

  it('isolates paths by authenticated user id', () => {
    expect(storage).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  });

  it('allows deletion only for draft manuscripts', () => {
    const del = storage.match(
      /CREATE POLICY manuscripts_storage_delete_own_draft[\s\S]*?;/
    )?.[0] as string;
    expect(del).toBeTruthy();
    expect(del).toMatch(/m\.status = 'draft'/);
  });

  it('removes the fake virus-scan trigger and does not claim scanning', () => {
    expect(storage).toMatch(/DROP FUNCTION IF EXISTS check_file_safety\(\)/i);
    expect(storage).toMatch(/scan_status/);
    expect(storage).toMatch(/pending/);
  });
});

describe('manuscript indexes migration (20260724000006)', () => {
  it('creates workflow indexes idempotently', () => {
    for (const idx of [
      'idx_manuscripts_status_submitted_at',
      'idx_manuscripts_assigned_reviewer_status',
      'idx_manuscripts_author_updated_at',
      'idx_manuscripts_active_review',
      'idx_manuscript_history_manuscript_created',
      'idx_manuscript_history_actor_created',
      'idx_manuscript_reviews_reviewer_decision',
      'idx_manuscript_reviews_manuscript_round',
    ]) {
      expect(indexes).toContain(idx);
    }
    expect(indexes).not.toMatch(/CREATE INDEX (?!IF NOT EXISTS)(?!.*UNIQUE)/);
  });

  it('does not recreate pre-existing base indexes', () => {
    for (const idx of [
      'idx_manuscripts_author\n',
      'idx_manuscripts_status\n',
      'idx_manuscripts_stage',
      'idx_manuscripts_submission_date',
    ]) {
      expect(indexes).not.toContain(idx.trim() + ' ');
    }
  });
});
