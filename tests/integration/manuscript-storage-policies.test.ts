/** @jest-environment node */
/**
 * Manuscript storage policy verification (PR 1).
 *
 * Statically verifies the storage.objects policies implementing the matrix:
 *   anonymous   list bucket                 -> denied (policies TO authenticated)
 *   author A    upload to own prefix       -> allowed
 *   author A    upload to author B prefix  -> denied (first path segment check)
 *   author A    read own / B's file        -> allowed / denied
 *   author A    unsupported MIME, >100MiB  -> denied (policy + bucket limits)
 *   author A    delete draft file          -> allowed
 *   author A    delete submitted file      -> denied (draft-only join)
 *   admin       any manuscript file        -> allowed via profiles.role
 *
 * Live bucket verification is an operator step against hosted Supabase.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260724000005_harden_manuscript_storage.sql'),
  'utf8'
);
// Executable SQL only (comments stripped) for negative assertions.
const code = sql.replace(/^\s*--.*$/gm, '');

const policy = (name: string) => {
  const m = sql.match(new RegExp(`CREATE POLICY ${name}[\\s\\S]*?;`));
  expect(m?.[0]).toBeTruthy();
  return m![0];
};

describe('bucket configuration', () => {
  it('remains private with exactly the approved limits', () => {
    const cfg = sql.match(/UPDATE storage\.buckets[\s\S]*?WHERE id = 'manuscripts';/)?.[0] as string;
    expect(cfg).toBeTruthy();
    expect(cfg).toMatch(/public = false/);
    expect(cfg).toContain('104857600');
    expect((cfg.match(/application\/|text\//g) ?? []).length).toBe(4);
  });
});

describe('owner isolation', () => {
  it('uploads only under the caller auth.uid() prefix with size and MIME re-checks', () => {
    const p = policy('manuscripts_storage_insert_own');
    expect(p).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    expect(p).toMatch(/104857600/);
    expect(p).toMatch(/application\/pdf/);
    expect(p).toMatch(/TO authenticated/i);
  });

  it('reads only within the caller prefix (cross-user download denied)', () => {
    const p = policy('manuscripts_storage_select_own');
    expect(p).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  });

  it('no author UPDATE policy exists (new versions are new uploads)', () => {
    expect(sql).not.toMatch(/CREATE POLICY manuscripts_storage_update/);
  });
});

describe('draft-only deletion', () => {
  it('joins to the owning manuscript and requires draft status', () => {
    const p = policy('manuscripts_storage_delete_own_draft');
    expect(p).toMatch(/JOIN authors a ON a\.id = m\.author_id/);
    expect(p).toMatch(/m\.status = 'draft'/);
    expect(p).toMatch(/\(storage\.foldername\(name\)\)\[2\]/);
  });
});

describe('admin access', () => {
  it('uses current_user_is_admin(), scoped to the manuscripts bucket', () => {
    const p = policy('manuscripts_storage_admin_all');
    expect(p).toMatch(/current_user_is_admin\(\)/);
    expect(p).toMatch(/bucket_id = 'manuscripts'/);
  });

  it('legacy JWT-role admin policy is dropped and never reintroduced', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Admins have full access to all files"/);
    expect(code).not.toMatch(/auth\.jwt\(\)/);
  });
});

describe('scan honesty', () => {
  it('drops the placeholder scanner and tags uploads scan_status=pending instead', () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS check_manuscript_safety/);
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS check_file_safety/);
    expect(sql).toMatch(/'scan_status', 'pending'/);
    expect(sql).not.toMatch(/virus scanning service/i);
  });
});
