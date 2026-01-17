import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple rate limiting utility
 * In production, use a proper rate limiting library like @upstash/ratelimit
 */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export function rateLimitMiddleware(
  req: NextRequest,
  limit: number = 10,
  windowMs: number = 60000
) {
  const identifier = req.ip || req.headers.get('x-forwarded-for') || 'anonymous';

  if (!rateLimit(identifier, limit, windowMs)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  return null;
}
