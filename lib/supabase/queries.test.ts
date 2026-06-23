/* eslint-disable @typescript-eslint/no-var-requires */
// PERF-PHASE2-2
import { revalidateBooks, revalidateAuthors, revalidateResonance } from './queries';

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn, _keys, _opts) => fn),
  revalidateTag: jest.fn(),
}));

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: (fn: any) => fn,
  };
});

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

describe('Cached query helpers', () => {
  it('revalidateBooks calls revalidateTag with books-list', () => {
    const { revalidateTag } = require('next/cache');
    revalidateBooks();
    expect(revalidateTag).toHaveBeenCalledWith('books-list');
  });

  it('revalidateAuthors calls revalidateTag with authors', () => {
    const { revalidateTag } = require('next/cache');
    revalidateAuthors();
    expect(revalidateTag).toHaveBeenCalledWith('authors');
  });

  it('revalidateResonance calls revalidateTag with resonance', () => {
    const { revalidateTag } = require('next/cache');
    revalidateResonance();
    expect(revalidateTag).toHaveBeenCalledWith('resonance');
  });
});
