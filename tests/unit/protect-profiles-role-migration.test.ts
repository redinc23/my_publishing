/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260717114020_protect_profiles_role.sql'
);

describe('protect profiles.role migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('forces role to reader on signup and ignores auth metadata role', () => {
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?\$\$;/i
    );
    expect(fnMatch?.[0]).toBeTruthy();
    const fnSql = fnMatch![0];
    expect(fnSql).toMatch(/SECURITY DEFINER/i);
    expect(fnSql).toMatch(/SET search_path = public/i);
    // The role column is populated from the literal 'reader'…
    expect(fnSql).toMatch(/'reader'/);
    // …never from client-controlled signup metadata.
    expect(fnSql).not.toMatch(/raw_user_meta_data->>'role'/i);
    expect(fnSql).toMatch(/ON CONFLICT \(user_id\) DO NOTHING/i);
  });

  it('blocks client self-escalation via the protect_profiles_role trigger', () => {
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.protect_profiles_role\(\)[\s\S]*?\$\$;/i
    );
    expect(fnMatch?.[0]).toBeTruthy();
    const fnSql = fnMatch![0];
    // service_role (admin actions) bypasses the guard.
    expect(fnSql).toMatch(/auth\.role\(\)[\s\S]*?=\s*'service_role'/i);
    // Admin check is keyed on user_id = auth.uid(), not profiles.id.
    expect(fnSql).toMatch(/p\.user_id = auth\.uid\(\)/i);
    expect(fnSql).toMatch(/p\.role = 'admin'/i);
    // Non-admin INSERT is coerced to reader; non-admin UPDATE keeps OLD.role.
    expect(fnSql).toMatch(/NEW\.role := 'reader'/i);
    expect(fnSql).toMatch(/NEW\.role := OLD\.role/i);
  });

  it('attaches the trigger before insert and update on profiles', () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS protect_profiles_role ON public\.profiles/i);
    expect(sql).toMatch(
      /CREATE TRIGGER protect_profiles_role[\s\S]*?BEFORE INSERT OR UPDATE ON public\.profiles[\s\S]*?EXECUTE FUNCTION public\.protect_profiles_role\(\)/i
    );
  });

  it('revokes column-level role writes from authenticated clients', () => {
    expect(sql).toMatch(/REVOKE UPDATE \(role\) ON TABLE public\.profiles FROM authenticated/i);
    expect(sql).toMatch(/REVOKE INSERT \(role\) ON TABLE public\.profiles FROM authenticated/i);
    // anon must not regain write access to profiles.
    expect(sql).toMatch(/GRANT SELECT ON TABLE public\.profiles TO anon/i);
    expect(sql).not.toMatch(/GRANT (ALL|INSERT|UPDATE|DELETE)[^\n]*TO anon/i);
  });
});
