import { NextResponse } from 'next/server';

/**
 * Lightweight liveness probe for Cloud Run.
 * Keeps process-level checks separate from dependency-heavy readiness checks.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
