/** @jest-environment node */

/**
 * E-001 — Book clubs honesty (G6).
 * Stub routes must not look like a live joinable clubs product.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

function readPage(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('E-001 book clubs honesty', () => {
  it('/book-clubs announces not available yet', () => {
    const src = readPage('app/(consumer)/book-clubs/page.tsx');
    expect(src).toMatch(/Not available yet/);
    expect(src).toMatch(/role="status"/);
    expect(src).not.toMatch(/Join book clubs/i);
    expect(src).not.toMatch(/Browse Clubs/i);
    expect(src).not.toMatch(/coming soon!/i);
  });

  it('/discover/book-clubs is an honest placeholder', () => {
    const src = readPage('app/(consumer)/discover/book-clubs/page.tsx');
    expect(src).toMatch(/Not available yet/);
    expect(src).toMatch(/placeholder/i);
    expect(src).not.toMatch(/coming soon!/i);
    expect(src).not.toMatch(/Browse Clubs/i);
  });

  it('discover hub does not promise joinable clubs', () => {
    const src = readPage('app/(consumer)/discover/page.tsx');
    expect(src).toMatch(/not available yet/i);
    expect(src).toMatch(/View status/);
    expect(src).not.toMatch(/Browse Clubs/);
    expect(src).not.toMatch(/Join book clubs and discuss/);
  });
});
