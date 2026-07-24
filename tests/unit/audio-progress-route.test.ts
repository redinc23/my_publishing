/** @jest-environment node */

import { GET, PUT } from '@/app/api/audio/progress/route';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/rate-limit';

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
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(),
  getRateLimitIdentity: jest.fn(() => 'audio-progress-test'),
}));

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedEnforceRateLimit = enforceRateLimit as jest.MockedFunction<typeof enforceRateLimit>;

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const BOOK_ID = '33333333-3333-4333-8333-333333333333';

function profileQuery() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: PROFILE_ID }, error: null }),
  };
}

describe('audio progress API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedEnforceRateLimit.mockResolvedValue({
      success: true,
      reason: 'ok',
      limit: 30,
      remaining: 29,
      reset: Date.now() + 60_000,
      headers: {},
    });
  });

  it('rejects invalid progress before authentication or database access', async () => {
    const response = await PUT({
      url: 'https://example.test/api/audio/progress',
      headers: new Headers(),
      json: jest.fn().mockResolvedValue({
        book_id: 'invalid',
        position_seconds: -1,
        duration_seconds: 100,
      }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('loads progress for the authenticated profile only', async () => {
    const progressQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          book_id: BOOK_ID,
          position_seconds: 42,
          duration_seconds: 600,
          updated_at: '2026-07-19T00:00:00.000Z',
        },
        error: null,
      }),
    };
    const profile = profileQuery();
    mockedCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }),
      },
      from: jest.fn((table: string) =>
        table === 'profiles' ? profile : table === 'listening_progress' ? progressQuery : null
      ),
    } as never);

    const response = await GET({
      url: `https://example.test/api/audio/progress?book_id=${BOOK_ID}`,
      headers: new Headers(),
    } as Request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(progressQuery.eq).toHaveBeenCalledWith('user_id', PROFILE_ID);
    expect(payload.progress.position_seconds).toBe(42);
  });
});
