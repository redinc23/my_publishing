/** @jest-environment node */

import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260719042254_security_advisor_hardening.sql'),
  'utf8'
);

describe('security advisor hardening migration', () => {
  it('makes exposed views security invokers', () => {
    expect(sql).toMatch(/ALTER VIEW public\.book_overview SET \(security_invoker = true\)/i);
    expect(sql).toMatch(/ALTER VIEW public\.public_profiles SET \(security_invoker = true\)/i);
  });

  it('removes unrestricted engagement inserts', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Anyone can insert engagement events"/i);
    expect(sql).toMatch(/REVOKE INSERT[\s\S]*FROM PUBLIC, anon, authenticated/i);
  });

  it('pins mutable function search paths', () => {
    expect(sql).toMatch(/ALTER FUNCTION public\.update_updated_at_column\(\)/i);
    expect(sql).toMatch(/SET search_path = pg_catalog, public/i);
  });
});
