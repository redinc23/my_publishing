import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { EngagementEvent } from '@/types';

export async function POST(request: NextRequest) {
  try {
    let body: EngagementEvent;
    try {
      body = (await request.json()) as EngagementEvent;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { user_id, book_id, event_type, event_value } = body;

    if (!book_id || !event_type) {
      return NextResponse.json({ error: 'book_id and event_type are required' }, { status: 400 });
    }

    const supabase = await createClient();

    if (user_id) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (user.id !== user_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.from('engagement_events').insert({
      user_id: user_id || null,
      book_id,
      event_type,
      event_value: event_value || null,
    });

    if (error) {
      console.error('[Resonance Track] Failed to insert engagement event:', error);
      return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
