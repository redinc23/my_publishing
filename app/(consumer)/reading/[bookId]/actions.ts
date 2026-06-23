// PERF-PHASE2-6 — Lean autosave server action: only sends bookId + position
'use server';

import { createClient } from '@/lib/supabase/server';

export async function saveReadingProgress(bookId: string, position: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('reading_progress')
    .upsert(
      {
        user_id: user.id,
        book_id: bookId,
        current_position: position,
        is_finished: false,
        last_accessed: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_id' }
    );
}
