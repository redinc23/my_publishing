// PERF-PHASE2-6 — Lean autosave server action: only sends bookId + position
'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';

export async function saveReadingProgress(bookId: string, position: number) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) return;

  let entitled = false;
  try {
    entitled = await hasCompletedOrderForBook(admin, profile.id, bookId);
  } catch {
    return;
  }
  if (!entitled) return;

  await admin.from('reading_progress').upsert(
    {
      user_id: profile.id,
      book_id: bookId,
      current_position: position,
      is_finished: false,
      last_accessed: new Date().toISOString(),
    },
    { onConflict: 'user_id,book_id' }
  );
}
