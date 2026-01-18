import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, 100, 60000);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { events } = await request.json();

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid events data' },
        { status: 400 }
      );
    }

    // Get client IP and user agent
    const headersList = headers();
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip');
    const userAgent = headersList.get('user-agent');

    const supabase = await createClient();
    
    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser();

    // Enrich events with server-side data
    const enrichedEvents = events.map((event: any) => ({
      ...event,
      user_id: user?.id,
      ip_address: ip,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    }));

    // Insert events
    const { error } = await supabase
      .from('analytics_events')
      .insert(enrichedEvents);

    if (error) {
      console.error('Error inserting analytics events:', error);
      return NextResponse.json(
        { error: 'Failed to track events' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}