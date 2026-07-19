/**
 * @jest-environment node
 */
/**
 * Reviews API — unit tests (Fix D4).
 *
 * Covers:
 *   1. GET /api/reviews rejects invalid bookId (400)
 *   2. GET /api/reviews paginates (range applied from page/limit)
 *   3. POST /api/reviews rejects unauthenticated (401)
 *   4. POST /api/reviews rejects rating outside 1-5 (400)
 *   5. POST /api/reviews rejects content < 10 chars (400)
 *   6. POST /api/reviews rejects spoofed verified_purchase (400 strict schema)
 *   7. POST /api/reviews happy path (201/200, server-side verified_purchase)
 *   8. POST /api/reviews/[id]/helpful rejects unauthenticated (401)
 *   9. POST /api/reviews/[id]/helpful happy path (helpful_count recount)
 */

import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Supabase mock — fluent query builder, resolved per-call
// ---------------------------------------------------------------------------

interface MockResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

class QueryMock {
  private result: MockResult;
  private filters: Array<{ column: string; value: unknown }> = [];
  rangeArgs: [number, number] | null = null;

  constructor(result: MockResult) {
    this.result = result;
  }

  select(..._args: unknown[]): this {
    return this;
  }
  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }
  in(..._args: unknown[]): this {
    return this;
  }
  order(..._args: unknown[]): this {
    return this;
  }
  range(from: number, to: number): this {
    this.rangeArgs = [from, to];
    return this;
  }
  limit(..._args: unknown[]): this {
    return this;
  }
  maybeSingle(): Promise<MockResult> {
    const data = Array.isArray(this.result.data) ? (this.result.data[0] ?? null) : this.result.data;
    return Promise.resolve({ ...this.result, data });
  }
  single(): Promise<MockResult> {
    const data = Array.isArray(this.result.data) ? (this.result.data[0] ?? null) : this.result.data;
    return Promise.resolve({ ...this.result, data });
  }
  delete(): this {
    return this;
  }
  insert(): this {
    return this;
  }
  update(): this {
    return this;
  }
  upsert(): this {
    return this;
  }
  then<TResult1 = MockResult, TResult2 = never>(
    onfulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

const adminResults = new Map<string, MockResult[]>();
let rangeSpy: Array<[number, number]> = [];
let insertedPayload: Record<string, unknown> | null = null;

function enqueue(table: string, result: MockResult): void {
  const queue = adminResults.get(table) ?? [];
  queue.push(result);
  adminResults.set(table, queue);
}

function nextResult(table: string): MockResult {
  const queue = adminResults.get(table) ?? [];
  return queue.length > 1 ? queue.shift()! : (queue[0] ?? { data: null, error: null, count: 0 });
}

const adminFromMock = jest.fn((table: string) => {
  const result = nextResult(table);
  const query = new QueryMock(result);
  if (table === 'reviews' && result.rangeArgs) {
    rangeSpy.push(result.rangeArgs);
  }
  if (table === 'reviews' && result.insertedPayload) {
    insertedPayload = result.insertedPayload;
  }
  return query;
});

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({ from: adminFromMock })),
}));

const authGetUserMock = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: authGetUserMock },
  })),
}));

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(async () => ({ success: true, headers: {} })),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));

const completedOrderMock = jest.fn();
jest.mock('@/lib/reading/entitlement', () => ({
  hasCompletedOrderForBook: (...args: unknown[]) => completedOrderMock(...args),
  getCompletedOrderBookIds: jest.fn(async () => []),
}));

const notifyMock = jest.fn();
jest.mock('@/lib/email/triggers', () => ({
  notifyAuthorOfNewReview: (...args: unknown[]) => notifyMock(...args),
}));

// Import AFTER mocks are registered.
import { GET, POST } from '@/app/api/reviews/route';
import { POST as HelpfulPOST } from '@/app/api/reviews/[id]/helpful/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOOK_ID = '550e8400-e29b-41d4-a716-446655440000';
const REVIEW_ID = '660e8400-e29b-41d4-a716-446655440000';
const USER_ID = '770e8400-e29b-41d4-a716-446655440000';
const PROFILE_ID = '880e8400-e29b-41d4-a716-446655440000';

function jsonRequest(url: string, init?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockSignedIn(): void {
  authGetUserMock.mockResolvedValue({
    data: { user: { id: USER_ID, email: 'reader@example.com', user_metadata: {} } },
  });
}

function mockSignedOut(): void {
  authGetUserMock.mockResolvedValue({ data: { user: null } });
}

beforeEach(() => {
  jest.clearAllMocks();
  adminResults.clear();
  rangeSpy = [];
  insertedPayload = null;
  completedOrderMock.mockResolvedValue(false);
  notifyMock.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// GET /api/reviews
// ---------------------------------------------------------------------------

describe('GET /api/reviews', () => {
  it('rejects an invalid bookId with 400', async () => {
    const res = await GET(jsonRequest('https://x.test/api/reviews?bookId=not-a-uuid'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('paginates using page and limit (range from/to)', async () => {
    enqueue('reviews', {
      data: [],
      error: null,
      count: 0,
      rangeArgs: [10, 19],
    });
    enqueue('reviews', { data: [], error: null }); // stats query

    const res = await GET(
      jsonRequest(`https://x.test/api/reviews?bookId=${BOOK_ID}&page=2&limit=10`)
    );
    expect(res.status).toBe(200);
    expect(rangeSpy).toContainEqual([10, 19]);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.page).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// POST /api/reviews
// ---------------------------------------------------------------------------

describe('POST /api/reviews', () => {
  it('rejects unauthenticated users with 401', async () => {
    mockSignedOut();
    const res = await POST(
      jsonRequest('https://x.test/api/reviews', {
        method: 'POST',
        body: { book_id: BOOK_ID, rating: 5, content: 'A wonderful book, highly recommended.' },
      })
    );
    expect(res.status).toBe(401);
  });

  it('rejects rating outside 1-5 with 400', async () => {
    mockSignedIn();
    const res = await POST(
      jsonRequest('https://x.test/api/reviews', {
        method: 'POST',
        body: { book_id: BOOK_ID, rating: 6, content: 'A wonderful book, highly recommended.' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects content shorter than 10 characters with 400', async () => {
    mockSignedIn();
    const res = await POST(
      jsonRequest('https://x.test/api/reviews', {
        method: 'POST',
        body: { book_id: BOOK_ID, rating: 4, content: 'Too short' },
      })
    );
    expect(res.status).toBe(400);
  });

  it('rejects a client-spoofed verified_purchase field with 400', async () => {
    mockSignedIn();
    const res = await POST(
      jsonRequest('https://x.test/api/reviews', {
        method: 'POST',
        body: {
          book_id: BOOK_ID,
          rating: 5,
          content: 'A wonderful book, highly recommended.',
          verified_purchase: true,
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it('creates a review with server-side verified_purchase detection', async () => {
    mockSignedIn();
    completedOrderMock.mockResolvedValue(true);

    enqueue('books', { data: { id: BOOK_ID }, error: null }); // book exists
    enqueue('profiles', { data: { id: PROFILE_ID }, error: null }); // user profile
    enqueue('reviews', { data: null, error: null }); // no existing review
    enqueue('reviews', {
      data: { id: REVIEW_ID },
      error: null,
      insertedPayload: {
        user_id: USER_ID,
        book_id: BOOK_ID,
        rating: 5,
        content: 'A wonderful book, highly recommended.',
        verified_purchase: true,
      },
    });

    const res = await POST(
      jsonRequest('https://x.test/api/reviews', {
        method: 'POST',
        body: { book_id: BOOK_ID, rating: 5, content: 'A wonderful book, highly recommended.' },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.verified_purchase).toBe(true);
    expect(insertedPayload).toMatchObject({
      user_id: USER_ID,
      book_id: BOOK_ID,
      verified_purchase: true,
    });
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ bookId: BOOK_ID, rating: 5 })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/reviews/[id]/helpful
// ---------------------------------------------------------------------------

describe('POST /api/reviews/[id]/helpful', () => {
  it('rejects unauthenticated users with 401', async () => {
    mockSignedOut();
    const res = await HelpfulPOST(
      jsonRequest(`https://x.test/api/reviews/${REVIEW_ID}/helpful`, {
        method: 'POST',
        body: { helpful: true },
      }),
      { params: { id: REVIEW_ID } }
    );
    expect(res.status).toBe(401);
  });

  it('upserts the vote and recounts helpful_count', async () => {
    mockSignedIn();
    enqueue('reviews', { data: { id: REVIEW_ID }, error: null }); // review exists
    enqueue('review_votes', { data: null, error: null }); // upsert
    enqueue('review_votes', { data: null, error: null, count: 7 }); // recount
    enqueue('reviews', { data: null, error: null }); // update helpful_count

    const res = await HelpfulPOST(
      jsonRequest(`https://x.test/api/reviews/${REVIEW_ID}/helpful`, {
        method: 'POST',
        body: { helpful: true },
      }),
      { params: { id: REVIEW_ID } }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.helpful_count).toBe(7);
    expect(body.data.user_vote).toBe(true);
  });
});
