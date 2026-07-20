/** @jest-environment node */

import { GET as getBooks, POST as postBook } from '@/app/api/books/route';
import { GET as getBook, PATCH as patchBook } from '@/app/api/books/[id]/route';
import { getRequestUser } from '@/lib/api/request-auth';
import { isMongoPrimary } from '@/lib/db/provider';
import {
  getBookById,
  getBooks as mongoGetBooks,
  insertBook,
  updateBook,
} from '@/lib/mongo-queries';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
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

jest.mock('@/lib/api/request-auth', () => ({
  getRequestUser: jest.fn(),
}));
jest.mock('@/lib/db/provider', () => ({
  isMongoPrimary: jest.fn(() => false),
  getDatabaseProvider: jest.fn(() => 'supabase'),
}));
jest.mock('@/lib/mongo-queries', () => ({
  DEFAULT_PAGE_SIZE: 20,
  getBooks: jest.fn(),
  getBookById: jest.fn(),
  insertBook: jest.fn(),
  updateBook: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabase/admin', () => ({ createClient: jest.fn() }));

const mockedIsMongo = isMongoPrimary as jest.MockedFunction<typeof isMongoPrimary>;
const mockedGetUser = getRequestUser as jest.MockedFunction<typeof getRequestUser>;
const mockedMongoGetBooks = mongoGetBooks as jest.MockedFunction<typeof mongoGetBooks>;
const mockedGetBookById = getBookById as jest.MockedFunction<typeof getBookById>;
const mockedInsertBook = insertBook as jest.MockedFunction<typeof insertBook>;
const mockedUpdateBook = updateBook as jest.MockedFunction<typeof updateBook>;
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedCreateAdmin = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

function getRequest(url: string): NextRequest {
  return { headers: new Headers(), nextUrl: new URL(url) } as unknown as NextRequest;
}

function jsonRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function makeQuery(resolved: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const method of [
    'select',
    'eq',
    'is',
    'order',
    'range',
    'insert',
    'update',
    'maybeSingle',
    'single',
  ]) {
    q[method] = jest.fn(() => q);
  }
  q.single = jest.fn().mockResolvedValue(resolved);
  q.maybeSingle = jest.fn().mockResolvedValue(resolved);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolved).then(onFulfilled, onRejected);
  return q;
}

describe('books API (WS2b)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsMongo.mockReturnValue(false);
    mockedGetUser.mockResolvedValue(null);
  });

  describe('GET /api/books', () => {
    it('lists via Mongo when DATABASE_PROVIDER=mongodb', async () => {
      mockedIsMongo.mockReturnValue(true);
      mockedMongoGetBooks.mockResolvedValue({
        items: [{ slug: 'a' } as never],
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const res = await getBooks(getRequest('https://x.test/api/books'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.items).toHaveLength(1);
      expect(mockedMongoGetBooks).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
        expect.objectContaining({ page: 1, perPage: 20 })
      );
    });

    it('lists via Supabase by default', async () => {
      mockedCreateAdmin.mockReturnValue({
        from: jest.fn(() => makeQuery({ data: [{ id: 'b1', title: 'T' }], error: null, count: 1 })),
      } as never);

      const res = await getBooks(getRequest('https://x.test/api/books?page=1'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(mockedMongoGetBooks).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/books', () => {
    it('requires auth', async () => {
      const res = await postBook(jsonRequest({ title: 'X' }));
      expect(res.status).toBe(401);
    });

    it('creates via Mongo when primary', async () => {
      mockedIsMongo.mockReturnValue(true);
      mockedGetUser.mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'author' });
      mockedInsertBook.mockResolvedValue('507f1f77bcf86cd799439011');

      const res = await postBook(jsonRequest({ title: 'My Book' }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe('507f1f77bcf86cd799439011');
      expect(mockedInsertBook).toHaveBeenCalled();
    });
  });

  describe('GET /api/books/[id]', () => {
    it('returns 404 when Mongo book missing', async () => {
      mockedIsMongo.mockReturnValue(true);
      mockedGetBookById.mockResolvedValue(null);
      const res = await getBook(getRequest('https://x.test/api/books/abc'), {
        params: { id: 'abc' },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/books/[id]', () => {
    it('forbids non-owners on Mongo', async () => {
      mockedIsMongo.mockReturnValue(true);
      mockedGetUser.mockResolvedValue({ id: 'u1', role: 'reader' });
      mockedGetBookById.mockResolvedValue({
        _id: 'b1' as never,
        author_id: 'other',
        title: 'T',
        slug: 't',
        status: 'draft',
        avg_rating: 0,
        review_count: 0,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const res = await patchBook(jsonRequest({ title: 'Nope' }), {
        params: { id: 'b1' },
      });
      expect(res.status).toBe(403);
      expect(mockedUpdateBook).not.toHaveBeenCalled();
    });

    it('updates when owner on Mongo', async () => {
      mockedIsMongo.mockReturnValue(true);
      mockedGetUser.mockResolvedValue({ id: 'u1', role: 'author' });
      mockedGetBookById
        .mockResolvedValueOnce({
          _id: 'b1' as never,
          author_id: 'u1',
          title: 'T',
          slug: 't',
          status: 'draft',
          avg_rating: 0,
          review_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .mockResolvedValueOnce({
          _id: 'b1' as never,
          author_id: 'u1',
          title: 'New',
          slug: 't',
          status: 'draft',
          avg_rating: 0,
          review_count: 0,
          created_at: new Date(),
          updated_at: new Date(),
        });
      mockedUpdateBook.mockResolvedValue(true);

      const res = await patchBook(jsonRequest({ title: 'New' }), {
        params: { id: 'b1' },
      });
      expect(res.status).toBe(200);
      expect(mockedUpdateBook).toHaveBeenCalled();
    });
  });

  describe('Supabase POST path', () => {
    it('inserts via supabase client', async () => {
      mockedGetUser.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
      const q = makeQuery({ data: { id: 'sb-1' }, error: null });
      mockedCreateClient.mockResolvedValue({
        from: jest.fn(() => q),
      } as never);

      const res = await postBook(jsonRequest({ title: 'Supabase Book' }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe('sb-1');
    });
  });
});
