import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Readiness probe endpoint for Kubernetes/Docker
 * Checks if the application is ready to serve traffic
 */
export async function GET() {
  try {
    // Check database connectivity
    const supabase = await createClient();
    const { error } = await supabase
      .from('books')
      .select('id')
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          checks: {
            database: 'failed',
          },
          error: error.message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

export const dynamic = 'force-dynamic';
