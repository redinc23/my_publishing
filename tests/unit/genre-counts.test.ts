/**
 * Genre counts tests (directive Phase 10.10): slug normalization, valid
 * counts, true zero, query-failure null (unavailable state).
 */
import { getGenreCounts, slugifyGenre } from '@/lib/supabase/genre-counts';

jest.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
}));

const mockSelect = jest.fn();
jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({ select: mockSelect })),
  })),
}));

function defineRows(rows: { genre: string | null }[] | null, error: unknown = null) {
  const terminal = { data: rows, error };
  mockSelect.mockReturnValue({
    eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue(terminal) }),
  });
}

describe('slugifyGenre', () => {
  it('normalizes display names to route slugs', () => {
    expect(slugifyGenre('Sci-Fi')).toBe('sci-fi');
    expect(slugifyGenre("Children's")).toBe('childrens');
    expect(slugifyGenre('Non Fiction')).toBe('non-fiction');
    expect(slugifyGenre('Non-Fiction')).toBe('non-fiction');
    expect(slugifyGenre('Self-Help')).toBe('self-help');
    expect(slugifyGenre('Science Fiction & Fantasy')).toBe('science-fiction-and-fantasy');
    expect(slugifyGenre('  Mystery  ')).toBe('mystery');
  });
});

describe('getGenreCounts', () => {
  it('returns real per-genre counts', async () => {
    defineRows([{ genre: 'Fiction' }, { genre: 'fiction' }, { genre: 'Sci-Fi' }, { genre: null }]);
    const counts = await getGenreCounts();
    expect(counts).toEqual({ fiction: 2, 'sci-fi': 1 });
  });

  it('returns an empty object for a true-zero catalog (not null)', async () => {
    defineRows([]);
    const counts = await getGenreCounts();
    expect(counts).toEqual({});
    expect(counts).not.toBeNull();
  });

  it('returns null on query failure (unavailable state)', async () => {
    defineRows(null, { message: 'RLS denied' });
    await expect(getGenreCounts()).resolves.toBeNull();
  });
});
