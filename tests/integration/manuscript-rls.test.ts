/** @jest-environment node */
/**
 * Manuscript RLS boundary verification (PR 1).
 *
 * These tests statically verify the policy/trigger definitions that implement
 * the actor matrix from TS-PUB-002. Live verification against a hosted
 * database remains an operator step (see scripts/verify-rls.ts and
 * docs/MIGRATIONS.md), consistent with the repo's existing RLS test approach.
 *
 * Actor matrix encoded here:
 *   anonymous            select                    -> denied (no anon grant/policy)
 *   reader (non-author)  select others             -> denied (ownership subquery)
 *   author A             select/insert/update own  -> allowed within status rules
 *   author A             touch workflow fields     -> denied (protection trigger)
 *   author A             set accepted status       -> denied (legal transitions only)
 *   author A             withdraw submitted        -> allowed
 *   assigned reviewer    read/update assigned      -> allowed
 *   admin                everything                -> allowed via profiles.role
 *   forged JWT metadata  admin actions             -> denied (no auth.jwt() use)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260724000004_harden_manuscript_rls.sql'),
  'utf8'
);
// Executable SQL only (comments stripped) for negative assertions.
const code = sql.replace(/^\s*--.*$/gm, '');

const policy = (name: string) => {
  const m = sql.match(new RegExp(`CREATE POLICY ${name}[\\s\\S]*?;`));
  expect(m?.[0]).toBeTruthy();
  return m![0];
};

describe('anonymous and cross-user access', () => {
  it('grants manuscript policies to authenticated only (anonymous denied)', () => {
    for (const p of [
      'manuscripts_select_own_or_admin',
      'manuscripts_insert_own_drafts',
      'manuscripts_update_own_editable',
      'manuscripts_delete_own_drafts',
    ]) {
      expect(policy(p)).toMatch(/TO authenticated/i);
    }
  });

  it('scopes every author policy through the authors -> profile ownership chain', () => {
    for (const p of [
      'manuscripts_select_own_or_admin',
      'manuscripts_insert_own_drafts',
      'manuscripts_update_own_editable',
      'manuscripts_delete_own_drafts',
    ]) {
      expect(policy(p)).toMatch(/a\.profile_id = public\.current_profile_id\(\)/);
    }
  });
});

describe('author write boundaries', () => {
  it('inserts are restricted to own author_id with draft/submitted status', () => {
    const p = policy('manuscripts_insert_own_drafts');
    expect(p).toMatch(/WITH CHECK/i);
    expect(p).toMatch(/status IN \('draft', 'submitted'\)/);
  });

  it('updates allowed only in author-editable statuses', () => {
    const p = policy('manuscripts_update_own_editable');
    expect(p).toMatch(/status IN \('draft', 'revisions_requested', 'submitted'\)/);
  });

  it('deletes allowed only for drafts', () => {
    expect(policy('manuscripts_delete_own_drafts')).toMatch(/status = 'draft'/);
  });

  it('authors cannot set accepted/rejected or edit editorial fields (trigger)', () => {
    const trigger = sql.match(
      /CREATE OR REPLACE FUNCTION protect_manuscript_workflow_fields[\s\S]*?\$\$;/
    )?.[0] as string;
    expect(trigger).toBeTruthy();
    for (const field of [
      'assigned_reviewer_id',
      'editorial_notes',
      'internal_notes',
      'book_id',
      'converted_at',
    ]) {
      expect(trigger).toContain(field);
    }
    // Only the three legal transitions appear; accepted/rejected are absent.
    expect(trigger).not.toMatch(/NEW\.status = 'accepted'/);
    expect(trigger).not.toMatch(/NEW\.status = 'rejected'/);
    expect(trigger).toMatch(/'submitted' AND NEW\.status = 'withdrawn'/);
  });
});

describe('reviewer access', () => {
  it('reviewers read only their own reviews', () => {
    expect(policy('manuscript_reviews_reviewer_select')).toMatch(
      /reviewer_profile_id = public\.current_profile_id\(\)/
    );
  });

  it('reviewers update only reviews for manuscripts assigned to them', () => {
    const p = policy('manuscript_reviews_reviewer_update');
    expect(p).toMatch(/assigned_reviewer_id = public\.current_profile_id\(\)/);
  });
});

describe('admin authority', () => {
  it('admin policies use the authoritative profiles.role helper', () => {
    expect(policy('manuscripts_admin_all')).toMatch(/current_user_is_admin\(\)/);
    expect(policy('manuscript_reviews_admin_all')).toMatch(/current_user_is_admin\(\)/);
  });

  it('forged user metadata grants nothing: no auth.jwt() role checks anywhere', () => {
    expect(code).not.toMatch(/auth\.jwt\(\)/);
    expect(code).not.toMatch(/raw_user_meta_data/);
  });

  it('current_user_is_admin resolves through profiles.role only', () => {
    const fn = sql.match(
      /CREATE OR REPLACE FUNCTION public\.current_user_is_admin[\s\S]*?\$\$;/
    )?.[0] as string;
    expect(fn).toMatch(/FROM profiles/i);
    expect(fn).toMatch(/role = 'admin'/);
    expect(fn).toMatch(/user_id = auth\.uid\(\)/);
  });
});

describe('author-safe surfaces', () => {
  it('history: authors get the view, not the raw table', () => {
    // Raw table: admin-only SELECT policy, nothing for authors.
    expect(sql).toMatch(/manuscript_history_admin_select/);
    expect(sql).not.toMatch(/CREATE POLICY manuscript_history_select_own/);
    // View excludes staff-only fields.
    const view = sql.match(
      /CREATE OR REPLACE VIEW author_manuscript_status_history[\s\S]*?;/
    )?.[0] as string;
    expect(view).not.toMatch(/internal_reason/);
  });

  it('feedback: view hides reviewer identity and internal notes, pending decisions excluded', () => {
    const view = sql.match(
      /CREATE OR REPLACE VIEW author_manuscript_feedback[\s\S]*?WHERE[\s\S]*?\);/
    )?.[0] as string;
    expect(view).toBeTruthy();
    expect(view).toMatch(/submitted_at IS NOT NULL/);
    expect(view).not.toMatch(/internal_notes/);
  });
});
