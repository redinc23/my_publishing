/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260717000000_tighten_analytics_sessions_rls.sql'
);

describe('analytics_sessions RLS migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates a safe public_profiles view without email or preferences', () => {
    const viewMatch = sql.match(
      /CREATE OR REPLACE VIEW public\.public_profiles[\s\S]*?FROM public\.profiles;/i
    );
    expect(viewMatch?.[0]).toBeTruthy();
    const viewSql = viewMatch![0];
    expect(viewSql).toMatch(/full_name AS name/i);
    expect(viewSql).toMatch(/user_id/);
    expect(viewSql).not.toMatch(/\bemail\b/i);
    expect(viewSql).not.toMatch(/\bpreferences\b/i);
  });

  it('restricts session management to service_role', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "System can manage sessions"/i);
    expect(sql).toMatch(/Service role can manage sessions/i);
    expect(sql).toMatch(
      /CREATE POLICY "Service role can manage sessions"[\s\S]*FOR ALL[\s\S]*TO service_role[\s\S]*USING \(true\)/i
    );
    expect(sql).not.toMatch(/CREATE POLICY "System can manage sessions"/i);
  });

  it('preserves author-scoped SELECT via profile → author → books', () => {
    expect(sql).toMatch(/Authors can view sessions for their books/i);
    expect(sql).toMatch(/p\.user_id = auth\.uid\(\)/i);
    expect(sql).toMatch(/a\.id = b\.author_id/i);
    expect(sql).not.toMatch(/author_id = auth\.uid\(\)/);
  });

  it('makes session maintenance functions SECURITY DEFINER', () => {
    expect(sql).toMatch(/FUNCTION update_analytics_session\(\)[\s\S]*SECURITY DEFINER/i);
    expect(sql).toMatch(/FUNCTION mark_inactive_sessions\(\)[\s\S]*SECURITY DEFINER/i);
  });
});
