/**
 * scripts/validate-gap-ledger.ts
 *
 * Validates docs/product-gap-ledger.yml (Run R1 canonical ledger).
 *
 * CONSTRAINT — no new npm dependencies (repo freeze). This file implements a
 * minimal parser for the ledger's OWN constrained YAML subset instead of
 * pulling in a YAML library. Supported subset (documented contract for
 * docs/product-gap-ledger.yml):
 *   - 2-space indentation per level
 *   - list items introduced by "- id:" (one per gap item, under `items:`)
 *   - "key: value" scalar fields
 *   - folded ">" block scalars (continuation lines deeper-indented)
 *   - [inline arrays] (single-line flow sequences)
 *   - null literals
 *   - full-line "#" comments and trailing comments after quoted scalars
 * Anything outside this subset is a parse error, not silent misbehavior.
 *
 * Exit 1 (FAIL) if ANY of:
 *   1. any id in P-001..P-060 is missing from items
 *   2. counts by product_priority differ from meta.totals (31 / 23 / 6)
 *   3. any id matches /^P0-\d/  (namespace collision with the release backlog)
 *   4. an item is READY while target_behavior, shipping_lane, dependencies,
 *      or evidence_required is null/empty
 *      (dependencies: [] is PRESENT; only null/missing fails)
 *   5. any dependency references an id not present in items
 *   6. candidate_sha is set while status is UNMAPPED or SCOPE_DECISION
 *   7. gate_tie names a gate not in G1..G13 (N/A valid, comma-separated valid)
 *   8. duplicate ids
 *
 * Run: npx tsx scripts/validate-gap-ledger.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Portable script dir: works under tsx (CJS) and plain node>=22 type-stripping (ESM).
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = path.join(SCRIPT_DIR, '..', 'docs', 'product-gap-ledger.yml');

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

type Value = string | string[] | null;

interface Item {
  id: string;
  fields: Record<string, Value>;
}

function parseLedger(text: string): { totals: Record<string, number>; items: Item[] } {
  const lines = text.split(/\r?\n/);
  const totals: Record<string, number> = {};
  const items: Item[] = [];
  let section: 'top' | 'meta' | 'items' = 'top';
  let inTotals = false;
  let current: Item | null = null;
  let currentKey: string | null = null;
  let folded: string[] | null = null;

  const flushFolded = () => {
    if (current && currentKey && folded) {
      current.fields[currentKey] = folded.join(' ').replace(/\s+/g, ' ').trim();
    }
    folded = null;
  };

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln];
    const lineNo = ln + 1;
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;

    // Folded-block continuation: deeper indent than the owning key.
    if (folded) {
      const indent = raw.match(/^ */)![0].length;
      if (indent >= 6) {
        folded.push(raw.trim());
        continue;
      }
      flushFolded();
    }

    if (/^meta:/.test(raw)) {
      section = 'meta';
      continue;
    }
    if (/^items:/.test(raw)) {
      section = 'items';
      inTotals = false;
      continue;
    }

    if (section === 'meta') {
      if (/^  totals:/.test(raw)) {
        inTotals = true;
        continue;
      }
      if (inTotals) {
        const m = raw.match(/^    (P0|P1|P2|total):\s*(\d+)\s*$/);
        if (m) {
          totals[m[1]] = parseInt(m[2], 10);
          continue;
        }
        inTotals = false; // left the totals block
      }
      continue; // other meta fields not needed for validation
    }

    if (section === 'items') {
      const itemStart = raw.match(/^  - id:\s*(\S+)\s*$/);
      if (itemStart) {
        current = { id: itemStart[1], fields: { id: itemStart[1] } };
        items.push(current);
        currentKey = null;
        continue;
      }
      if (!current) {
        fail(`line ${lineNo}: content under items: before first "- id:" entry`);
        continue;
      }
      const kv = raw.match(/^    ([a-z_]+):\s*(.*)$/);
      if (!kv) {
        fail(`line ${lineNo}: unparseable line in ledger subset: ${raw.trim()}`);
        continue;
      }
      const [, key, restRaw] = kv;
      currentKey = key;
      const rest = restRaw.trim();
      if (rest === '>') {
        folded = [];
      } else if (rest === 'null' || rest === '') {
        current.fields[key] = null;
      } else if (rest.startsWith('[')) {
        const m = rest.match(/^\[(.*)\]\s*(#.*)?$/);
        if (!m) {
          fail(`line ${lineNo}: malformed inline array for ${key}`);
          continue;
        }
        current.fields[key] = m[1]
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .filter((s) => s.length > 0);
      } else {
        // scalar; strip surrounding quotes and any trailing comment after a quoted scalar
        let v = rest;
        const q = v.match(/^(["'])(.*)\1\s*(#.*)?$/);
        if (q) v = q[2];
        current.fields[key] = v;
      }
    }
  }
  flushFolded();
  return { totals, items };
}

function main() {
  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`FAIL: ledger not found at ${LEDGER_PATH}`);
    process.exit(1);
  }
  const { totals, items } = parseLedger(fs.readFileSync(LEDGER_PATH, 'utf8'));

  const isEmpty = (v: Value | undefined): boolean =>
    v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

  // Rule 8: duplicate ids
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id)) fail(`duplicate id ${it.id}`);
    seen.add(it.id);
  }

  // Rule 3: namespace collision
  for (const it of items) {
    if (/^P0-\d/.test(it.id)) {
      fail(`${it.id}: id matches /^P0-\\d/ — collides with the NEXT_GO release backlog namespace; Product Gap IDs are P-###`);
    }
  }

  // Rule 1: completeness P-001..P-060
  for (let i = 1; i <= 60; i++) {
    const id = `P-${String(i).padStart(3, '0')}`;
    if (!seen.has(id)) fail(`missing required id ${id}`);
  }

  // Rule 2: priority totals
  const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0 };
  for (const it of items) {
    const p = it.fields.product_priority;
    if (typeof p === 'string' && p in counts) counts[p]++;
    else fail(`${it.id}: product_priority missing or not one of P0/P1/P2 (got: ${String(p)})`);
  }
  for (const tier of ['P0', 'P1', 'P2']) {
    const expected = totals[tier];
    if (expected === undefined) {
      fail(`meta.totals.${tier} missing`);
    } else if (counts[tier] !== expected) {
      fail(`priority count mismatch: ${tier} has ${counts[tier]} items but meta.totals declares ${expected}`);
    }
  }

  const VALID_GATES = new Set(['N/A', ...Array.from({ length: 13 }, (_, i) => `G${i + 1}`)]);

  for (const it of items) {
    const f = it.fields;

    // Rule 4: READY completeness
    if (f.status === 'READY') {
      for (const key of ['target_behavior', 'shipping_lane', 'evidence_required'] as const) {
        if (isEmpty(f[key])) fail(`${it.id}: status READY but ${key} is null/empty`);
      }
      // dependencies: an empty array is present; only null/missing fails
      if (f.dependencies === undefined || f.dependencies === null) {
        fail(`${it.id}: status READY but dependencies is null/missing (use [] for none)`);
      }
    }

    // Rule 5: dependency references
    if (Array.isArray(f.dependencies)) {
      for (const dep of f.dependencies) {
        if (!seen.has(dep)) fail(`${it.id}: dependency ${dep} not present in items`);
      }
    }

    // Rule 6: candidate_sha vs status
    if (!isEmpty(f.candidate_sha) && (f.status === 'UNMAPPED' || f.status === 'SCOPE_DECISION')) {
      fail(`${it.id}: candidate_sha is set while status is ${String(f.status)}`);
    }

    // Rule 7: gate_tie validity (comma-separated list allowed)
    if (!isEmpty(f.gate_tie) && typeof f.gate_tie === 'string') {
      for (const g of f.gate_tie.split(',').map((s) => s.trim())) {
        if (!VALID_GATES.has(g)) fail(`${it.id}: gate_tie names unknown gate "${g}" (valid: G1..G13, N/A)`);
      }
    }
  }

  if (errors.length > 0) {
    console.error(`gap-ledger validation FAILED with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(
    `gap-ledger validation PASSED: ${items.length} items, ` +
      `P0=${counts.P0} P1=${counts.P1} P2=${counts.P2}, ids P-001..P-060 complete.`
  );
}

main();
