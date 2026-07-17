import {
  createPublicCatalogClient,
  PUBLIC_AUTHOR_COLUMNS,
  PUBLIC_BOOK_SELECT,
  PUBLIC_BOOK_WITH_CONTENT_SELECT,
  PUBLIC_PROFILE_COLUMNS,
} from '@/lib/supabase/public-queries';
import { createClient } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

describe('public catalog query helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the admin client for public catalog access', () => {
    const mockClient = { from: jest.fn() };
    (createClient as jest.Mock).mockReturnValue(mockClient);

    expect(createPublicCatalogClient()).toBe(mockClient);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('exposes only safe public profile columns', () => {
    expect(PUBLIC_PROFILE_COLUMNS).toBe('full_name');
    expect(PUBLIC_PROFILE_COLUMNS).not.toMatch(/email|preferences|user_id/i);
  });

  it('exposes only safe public author columns', () => {
    expect(PUBLIC_AUTHOR_COLUMNS).toContain('profile:profiles(full_name)');
    expect(PUBLIC_AUTHOR_COLUMNS).toContain('pen_name');
    expect(PUBLIC_AUTHOR_COLUMNS).not.toMatch(/email|preferences|user_id|royalty_rate/i);
  });

  it('builds public book selects from the safe author projection', () => {
    expect(PUBLIC_BOOK_SELECT).toBe(`*, author:authors(${PUBLIC_AUTHOR_COLUMNS})`);
    expect(PUBLIC_BOOK_WITH_CONTENT_SELECT).toBe(`${PUBLIC_BOOK_SELECT}, content:book_content(*)`);
    expect(PUBLIC_BOOK_SELECT).not.toMatch(/profiles\(\*\)|email|preferences/i);
  });
});
