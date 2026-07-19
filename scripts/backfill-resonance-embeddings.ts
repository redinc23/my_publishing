/* eslint-disable no-console */
/**
 * Resonance Engine — production embedding backfill.
 *
 * Generates 384-d text-embedding-3-small vectors for every published book
 * missing a resonance_vectors row (idempotent; safe to re-run). Without
 * OPENAI_API_KEY the script exits 0 with a clear message — the Resonance
 * Engine simply keeps serving its SQL fallbacks.
 *
 * Usage:
 *   npx tsx scripts/backfill-resonance-embeddings.ts [--limit N] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const args = process.argv.slice(2);
const limitFlag = args.find((arg) => arg.startsWith('--limit='));
const batchLimit = limitFlag ? Number.parseInt(limitFlag.split('=')[1] ?? '0', 10) : 0;
const dryRun = args.includes('--dry-run');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384;
/** Pause between OpenAI calls to stay friendly to rate limits. */
const REQUEST_DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log(
      'OPENAI_API_KEY not set — nothing to do. The Resonance Engine will keep ' +
        'serving SQL trending/editorial fallbacks until embeddings exist.'
    );
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Books with no embedding row yet.
  const { data: books, error: booksError } = await supabase
    .from('books')
    .select('id, title, description, genre')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (booksError) {
    console.error('Failed to list books:', booksError.message);
    process.exit(1);
  }

  const { data: vectorRows, error: vectorsError } = await supabase
    .from('resonance_vectors')
    .select('book_id')
    .not('embedding', 'is', null);
  if (vectorsError) {
    console.error('Failed to list existing vectors:', vectorsError.message);
    process.exit(1);
  }

  const embedded = new Set((vectorRows ?? []).map((row) => row.book_id as string));
  let pending = (books ?? []).filter((book) => !embedded.has(book.id as string));
  if (batchLimit > 0) pending = pending.slice(0, batchLimit);

  console.log(
    `${embedded.size} books already embedded; ${pending.length} to process` +
      (dryRun ? ' (dry run)' : '') +
      '.'
  );
  if (dryRun || pending.length === 0) {
    for (const book of pending.slice(0, 10)) {
      console.log(`  - ${book.title} (${book.id})`);
    }
    process.exit(0);
  }

  let success = 0;
  let failed = 0;
  for (const book of pending) {
    try {
      const text = `${book.title ?? ''} ${book.description ?? ''} ${book.genre ?? ''}`.trim();
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text || (book.title as string),
        dimensions: EMBEDDING_DIMENSIONS,
      });
      const embedding = response.data[0]?.embedding;
      if (!embedding) throw new Error('empty embedding response');

      const { error: upsertError } = await supabase.from('resonance_vectors').upsert(
        {
          book_id: book.id,
          embedding: JSON.stringify(embedding),
          metadata: {
            title: book.title,
            genre: book.genre,
            updated_at: new Date().toISOString(),
          },
        },
        { onConflict: 'book_id' }
      );
      if (upsertError) throw new Error(upsertError.message);

      success += 1;
      if (success % 10 === 0) console.log(`  …${success}/${pending.length}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${book.title}:`, error instanceof Error ? error.message : error);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`Done: ${success} embedded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
