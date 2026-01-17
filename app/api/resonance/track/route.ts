import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EngagementEvent } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: EngagementEvent = await request.json();
    const { user_id, book_id, event_type, event_value } = body;

    if (!book_id || !event_type) {
      return NextResponse.json({ error: 'book_id and event_type are required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase.from('engagement_events').insert({
      user_id: user_id || null,
      book_id,
      event_type,
      event_value: event_value || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
