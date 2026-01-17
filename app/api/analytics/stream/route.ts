import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookId = searchParams.get('bookId');
  
  if (!bookId) {
    return new Response('Missing bookId', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const supabase = await createClient();
      
      // Subscribe to real-time analytics
      const channel = supabase.channel(`analytics-${bookId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'analytics_events',
          filter: `book_id=eq.${bookId}`
        }, (payload) => {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify(payload.new)}\n\n`
          ));
        })
        .subscribe();

      // Keep connection alive
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        supabase.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}