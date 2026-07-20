/**
 * @jest-environment node
 *
 * Phoenix WS2b — books API auth + mongo list gating (mocked).
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) => ({
      status: init.status ?? 200,
      headers: new Headers(init.headers),
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn().mockResolvedValue({
    success: true,
    reason: 'ok',
    limit: 100,
    remaining: 99,
    reset: Date.now() + 60_000,
    headers: {},
  }),
  getClientIdentifier: jest.fn(() => 'test-client'),
}));

jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => true),
}));

jest.mock('@/lib/auth/request-user', () => ({
  getRequestAuthUser: jest.fn(),
  canMutateBooks: jest.fn((role: string) =>
    role === 'author' || role === 'partner' || role === 'admin'
  ),
}));

jest.mock('@/lib/mongo-queries', () => ({
  getBooks: jest.fn(),
  searchBooks: jest.fn(),
  getBookById: jest.fn(),
  getBookBySlug: jest.fn(),
}));

jest.mock('@/lib/mongo-books', () => ({
  insertBook: jest.fn(),
  updateBookById: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/public-queries', () => ({
  createPublicCatalogClient: jest.fn(),
}));

import { GET, POST } from '@/app/api/books/route';
import { GET as GET_ONE, PATCH } from '@/app/api/books/[id]/route';
import { getRequestAuthUser } from '@/lib/auth/request-user';
import { getBooks, getBookById } from '@/lib/mongo-queries';
import { insertBook, updateBookById } from '@/lib/mongo-books';
import type { NextRequest } from 'next/server';

const mockedGetUser = getRequestAuthUser as jest.MockedFunction<typeof getRequestAuthUser>;
const mockedGetBooks = getBooks as jest.MockedFunction<typeof getBooks>;
const mockedGetBookById = getBookById as jest.MockedFunction<typeof getBookById>;
const mockedInsertBook = insertBook as jest.MockedFunction<typeof insertBook>;
const mockedUpdateBook = updateBookById as jest.MockedFunction<typeof updateBookById>;

function listRequest(query = ''): NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(`http://localhost/api/books${query}`),
  } as unknown as NextRequest;
}

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
    nextUrl: new URL('http://localhost/api/books'),
  } as unknown as NextRequest;
}

describe('GET /api/books (mongo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated books from mongo-queries', async () => {
    mockedGetBooks.mockResolvedValue({
      items: [
        {
          _id: 'b1' as unknown as import('mongodb').ObjectId,
          title: 'Hello',
          slug: 'hello',
          author_id: 'a1',
          status: 'published',
          avg_rating: 0,
          review_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      total: 1,
      page: 1,
      perPage: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const res = await GET(listRequest('?status=published'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(mockedGetBooks).toHaveBeenCalled();
  });
});

describe('POST /api/books (mongo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated create', async () => {
    mockedGetUser.mockResolvedValue(null);
    const res = await POST(jsonRequest({ title: 'New Book' }));
    expect(res.status).toBe(401);
  });

  it('rejects reader role', async () => {
    mockedGetUser.mockResolvedValue({
      id: 'u1',
      role: 'reader',
      email: 'r@example.com',
      name: 'Reader',
    });
    const res = await POST(jsonRequest({ title: 'New Book' }));
    expect(res.status).toBe(403);
  });

  it('creates book for author', async () => {
    mockedGetUser.mockResolvedValue({
      id: 'author-1',
      role: 'author',
      email: 'a@example.com',
      name: 'Author',
    });
    mockedInsertBook.mockResolvedValue({
      _id: 'newid' as unknown as import('mongodb').ObjectId,
      title: 'New Book',
      slug: 'new-book',
      author_id: 'author-1',
      status: 'draft',
      avg_rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await POST(jsonRequest({ title: 'New Book' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(mockedInsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Book', authorId: 'author-1' })
    );
  });
});

describe('PATCH /api/books/[id] (mongo)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forbids non-owner non-admin', async () => {
    mockedGetUser.mockResolvedValue({
      id: 'other',
      role: 'author',
      email: 'o@example.com',
      name: 'Other',
    });
    mockedGetBookById.mockResolvedValue({
      _id: 'b1' as unknown as import('mongodb').ObjectId,
      title: 'Owned',
      slug: 'owned',
      author_id: 'owner-id',
      status: 'draft',
      avg_rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await PATCH(jsonRequest({ title: 'Hijack' }), { params: { id: 'b1' } });
    expect(res.status).toBe(403);
    expect(mockedUpdateBook).not.toHaveBeenCalled();
  });

  it('allows owner update', async () => {
    mockedGetUser.mockResolvedValue({
      id: 'owner-id',
      role: 'author',
      email: 'o@example.com',
      name: 'Owner',
    });
    mockedGetBookById.mockResolvedValue({
      _id: 'b1' as unknown as import('mongodb').ObjectId,
      title: 'Owned',
      slug: 'owned',
      author_id: 'owner-id',
      status: 'draft',
      avg_rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockedUpdateBook.mockResolvedValue({
      _id: 'b1' as unknown as import('mongodb').ObjectId,
      title: 'Updated',
      slug: 'updated',
      author_id: 'owner-id',
      status: 'draft',
      avg_rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await PATCH(jsonRequest({ title: 'Updated' }), { params: { id: 'b1' } });
    expect(res.status).toBe(200);
    expect(mockedUpdateBook).toHaveBeenCalled();
  });

  it('GET returns 404 when missing', async () => {
    mockedGetBookById.mockResolvedValue(null);
    const res = await GET_ONE(listRequest(), { params: { id: 'missing' } });
    expect(res.status).toBe(404);
  });
});
