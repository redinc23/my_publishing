/** @jest-environment node */

import { POST as trackEvent } from '@/app/api/resonance/track/route';
import { GET as getSimilarBooks } from '@/app/api/resonance/similar/route';
import { POST as uploadFile } from '@/app/api/upload/route';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createPublicCatalogClient } from '@/lib/supabase/public-queries';
import { enforceRateLimit } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/public-queries', () => ({
  createPublicCatalogClient: jest.fn(),
  PUBLIC_BOOK_SELECT: 'id,title',
}));
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockedCreatePublicClient = createPublicCatalogClient as jest.MockedFunction<
  typeof createPublicCatalogClient
>;
const mockedEnforceRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

describe('API route hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEnforceRateLimit.mockResolvedValue({
      success: true,
      reason: 'ok',
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
      headers: { 'X-RateLimit-Remaining': '29' },
    });
  });

  it('rejects malformed resonance events before database access', async () => {
    const response = await trackEvent(
      jsonRequest({ book_id: 'not-a-uuid', event_type: 'made-up', event_value: 'invalid' })
    );

    expect(response.status).toBe(400);
    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it('rate limits anonymous resonance tracking before parsing input', async () => {
    mockedEnforceRateLimit.mockResolvedValue({
      success: false,
      reason: 'limited',
      limit: 30,
      remaining: 0,
      reset: Date.now() + 30_000,
      headers: { 'Retry-After': '30' },
    });
    const request = jsonRequest({});

    const response = await trackEvent(request);

    expect(response.status).toBe(429);
    expect(request.json).not.toHaveBeenCalled();
  });

  it('accepts a validated anonymous resonance event', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn() },
    } as never);
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedCreateAdminClient.mockReturnValue({
      from: jest.fn(() => ({ insert })),
    } as never);

    const response = await trackEvent(
      jsonRequest({
        book_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'view',
        event_value: { source: 'catalog' },
      })
    );

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        book_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'view',
      })
    );
  });

  it('rejects a spoofed user_id when no user is authenticated', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    } as never);

    const response = await trackEvent(
      jsonRequest({
        user_id: '11111111-1111-4111-8111-111111111111',
        book_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'view',
      })
    );

    expect(response.status).toBe(401);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it('rejects a user_id that does not match the authenticated user', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
        }),
      },
    } as never);

    const response = await trackEvent(
      jsonRequest({
        // Attacker attributes the event to a different (victim) user id.
        user_id: '11111111-1111-4111-8111-111111111111',
        book_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'view',
      })
    );

    expect(response.status).toBe(403);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it('accepts a user_id that matches the authenticated user and inserts it verbatim', async () => {
    const authedId = '22222222-2222-4222-8222-222222222222';
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: authedId } } }),
      },
    } as never);
    const insert = jest.fn().mockResolvedValue({ error: null });
    mockedCreateAdminClient.mockReturnValue({
      from: jest.fn(() => ({ insert })),
    } as never);

    const response = await trackEvent(
      jsonRequest({
        user_id: authedId,
        book_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'view',
      })
    );

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: authedId }));
  });

  it('rejects unsupported upload MIME types before storage access', async () => {
    mockedCreateClient.mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    } as never);
    const formData = new FormData();
    formData.set(
      'file',
      new File(['payload'], 'payload.exe', { type: 'application/x-msdownload' })
    );
    const request = {
      formData: jest.fn().mockResolvedValue(formData),
    } as unknown as NextRequest;

    const response = await uploadFile(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/Unsupported file type/);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it('does not expose database errors from similar-books queries', async () => {
    const bookQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { genre: 'Fantasy' }, error: null }),
    };
    const similarQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'secret database connection details' },
      }),
    };
    mockedCreatePublicClient.mockReturnValue({
      from: jest.fn().mockReturnValueOnce(bookQuery).mockReturnValueOnce(similarQuery),
    } as never);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const request = {
      nextUrl: {
        searchParams: new URLSearchParams('book_id=550e8400-e29b-41d4-a716-446655440000&limit=6'),
      },
    } as unknown as NextRequest;

    const response = await getSimilarBooks(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: 'Failed to load similar books' });
    expect(JSON.stringify(payload)).not.toContain('secret database');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
