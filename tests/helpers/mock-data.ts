/**
 * Mock data factories for testing
 */
import type { Database } from '@/types/database';

type Book = Database['public']['Tables']['books']['Row'];
type Author = Database['public']['Tables']['authors']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Generate mock book data
 */
export function createMockBook(overrides?: Partial<Book>): Book {
  const id = overrides?.id || crypto.randomUUID();
  const title = overrides?.title || 'Test Book Title';
  const slug = overrides?.slug || 'test-book-title';

  return {
    id,
    isbn: null,
    title,
    slug,
    description: 'A fascinating test book description',
    cover_url: 'https://example.com/cover.jpg',
    trailer_vimeo_id: null,
    genre: 'Fiction',
    subgenres: ['Mystery', 'Thriller'],
    price: 9.99,
    discount_price: null,
    status: 'published',
    visibility: 'public',
    is_featured: false,
    featured_at: null,
    total_reads: 0,
    total_reviews: 0,
    average_rating: 0,
    page_count: 300,
    word_count: 75000,
    author_id: null,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate mock author data
 */
export function createMockAuthor(overrides?: Partial<Author>): Author {
  return {
    id: crypto.randomUUID(),
    profile_id: crypto.randomUUID(),
    pen_name: 'Test Author',
    bio: 'An acclaimed test author',
    photo_url: null,
    is_verified: true,
    total_books: 5,
    royalty_rate: 50.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate mock profile data
 */
export function createMockProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'reader',
    subscription_tier: 'free',
    preferences: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate multiple mock books
 */
export function createMockBooks(count: number): Book[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBook({
      id: crypto.randomUUID(),
      title: `Test Book ${i + 1}`,
      slug: `test-book-${i + 1}`,
    })
  );
}

/**
 * Mock user session data
 */
export function createMockSession() {
  return {
    user: {
      id: crypto.randomUUID(),
      email: 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    access_token: 'mock-access-token',
    expires_at: Date.now() + 3600000,
  };
}
