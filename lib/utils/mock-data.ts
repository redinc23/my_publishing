/**
 * Mock Data for Development
 * Provides fallback data when database is empty or unavailable
 */

import { useMocks } from './env-validation';
import type { BookWithAuthor } from '@/types';

/**
 * Check if mock mode should be used
 */
export function shouldUseMocks(): boolean {
  return useMocks();
}

/**
 * Mock books data
 */
export const mockBooks: BookWithAuthor[] = [
  {
    id: 'mock-book-1',
    title: 'The Memory Keeper',
    slug: 'the-memory-keeper',
    description:
      'A haunting tale of a woman who can steal and preserve memories, exploring themes of identity, loss, and the ethics of remembering.',
    genre: 'literary-fiction',
    subgenres: ['magical-realism', 'contemporary'],
    cover_url: 'https://picsum.photos/seed/book1/400/600',
    price: 14.99,
    discount_price: 9.99,
    status: 'published',
    is_featured: true,
    total_reads: 15234,
    total_reviews: 892,
    average_rating: 4.6,
    page_count: 342,
    word_count: 89000,
    published_at: new Date('2024-01-15').toISOString(),
    created_at: new Date('2023-12-01').toISOString(),
    updated_at: new Date('2024-01-15').toISOString(),
    author: {
      id: 'mock-author-1',
      pen_name: 'Elena Rodriguez',
      bio: 'Pulitzer Prize finalist known for lyrical prose exploring Latin American identity.',
      is_verified: true,
      profile: {
        id: 'mock-profile-1',
        email: 'elena@example.com',
        full_name: 'Elena Rodriguez',
        role: 'author',
        subscription_tier: 'premium',
      },
    },
  },
  {
    id: 'mock-book-2',
    title: 'Neural Eclipse',
    slug: 'neural-eclipse',
    description:
      'In 2157, an AI consciousness awakens in the global neural network, forcing humanity to confront what it means to be alive.',
    genre: 'sci-fi',
    subgenres: ['cyberpunk', 'ai'],
    cover_url: 'https://picsum.photos/seed/book2/400/600',
    price: 16.99,
    status: 'published',
    is_featured: true,
    total_reads: 23451,
    total_reviews: 1203,
    average_rating: 4.8,
    page_count: 428,
    word_count: 112000,
    published_at: new Date('2024-02-01').toISOString(),
    created_at: new Date('2023-11-15').toISOString(),
    updated_at: new Date('2024-02-01').toISOString(),
    author: {
      id: 'mock-author-2',
      pen_name: 'Marcus Chen',
      bio: 'Science fiction author exploring AI ethics and consciousness.',
      is_verified: true,
      profile: {
        id: 'mock-profile-2',
        email: 'marcus@example.com',
        full_name: 'Marcus Chen',
        role: 'author',
        subscription_tier: 'premium',
      },
    },
  },
  {
    id: 'mock-book-3',
    title: 'The Silent Witness',
    slug: 'the-silent-witness',
    description:
      'A detective must solve a murder where the only witness is a child who cannot speak.',
    genre: 'mystery',
    subgenres: ['crime', 'thriller'],
    cover_url: 'https://picsum.photos/seed/book3/400/600',
    price: 12.99,
    status: 'published',
    is_featured: true,
    total_reads: 18923,
    total_reviews: 1023,
    average_rating: 4.5,
    page_count: 312,
    word_count: 78000,
    published_at: new Date('2024-01-20').toISOString(),
    created_at: new Date('2023-10-20').toISOString(),
    updated_at: new Date('2024-01-20').toISOString(),
    author: {
      id: 'mock-author-3',
      pen_name: 'Sarah Okonkwo',
      bio: 'Mystery writer crafting intricate psychological thrillers.',
      is_verified: true,
      profile: {
        id: 'mock-profile-3',
        email: 'sarah@example.com',
        full_name: 'Sarah Okonkwo',
        role: 'author',
        subscription_tier: 'premium',
      },
    },
  },
  {
    id: 'mock-book-4',
    title: 'D-Day Chronicles',
    slug: 'd-day-chronicles',
    description:
      'A gripping account of the Normandy landings through the eyes of soldiers on both sides.',
    genre: 'historical-fiction',
    cover_url: 'https://picsum.photos/seed/book4/400/600',
    price: 15.99,
    discount_price: 11.99,
    status: 'published',
    is_featured: false,
    total_reads: 9876,
    total_reviews: 567,
    average_rating: 4.7,
    page_count: 456,
    word_count: 125000,
    published_at: new Date('2023-12-10').toISOString(),
    created_at: new Date('2023-09-15').toISOString(),
    updated_at: new Date('2023-12-10').toISOString(),
    author: {
      id: 'mock-author-4',
      pen_name: 'James Morrison',
      bio: 'Historical fiction novelist specializing in WWII narratives.',
      is_verified: true,
      profile: {
        id: 'mock-profile-4',
        email: 'james@example.com',
        full_name: 'James Morrison',
        role: 'author',
        subscription_tier: 'premium',
      },
    },
  },
  {
    id: 'mock-book-5',
    title: 'Love Across Borders',
    slug: 'love-across-borders',
    description:
      'Two people from different cultures find love despite family expectations and cultural barriers.',
    genre: 'romance',
    subgenres: ['contemporary', 'multicultural'],
    cover_url: 'https://picsum.photos/seed/book5/400/600',
    price: 9.99,
    status: 'published',
    is_featured: true,
    total_reads: 21345,
    total_reviews: 1234,
    average_rating: 4.4,
    page_count: 298,
    word_count: 72000,
    published_at: new Date('2024-01-05').toISOString(),
    created_at: new Date('2023-11-01').toISOString(),
    updated_at: new Date('2024-01-05').toISOString(),
    author: {
      id: 'mock-author-5',
      pen_name: 'Priya Sharma',
      bio: 'Romance author with a focus on cultural identity and belonging.',
      is_verified: true,
      profile: {
        id: 'mock-profile-5',
        email: 'priya@example.com',
        full_name: 'Priya Sharma',
        role: 'author',
        subscription_tier: 'premium',
      },
    },
  },
];

/**
 * Get featured books (mock data)
 */
export function getMockFeaturedBooks(): BookWithAuthor[] {
  return mockBooks.filter((book) => book.is_featured).slice(0, 6);
}

/**
 * Get trending books (mock data)
 */
export function getMockTrendingBooks(): BookWithAuthor[] {
  return [...mockBooks]
    .sort((a, b) => b.total_reads - a.total_reads)
    .slice(0, 12);
}

/**
 * Get all mock books
 */
export function getMockBooks(): BookWithAuthor[] {
  return mockBooks;
}

/**
 * Get mock book by slug
 */
export function getMockBookBySlug(slug: string): BookWithAuthor | null {
  return mockBooks.find((book) => book.slug === slug) || null;
}

/**
 * Get mock books by genre
 */
export function getMockBooksByGenre(genre: string): BookWithAuthor[] {
  return mockBooks.filter((book) => book.genre === genre);
}

/**
 * Search mock books
 */
export function searchMockBooks(query: string): BookWithAuthor[] {
  const lowerQuery = query.toLowerCase();
  return mockBooks.filter(
    (book) =>
      book.title.toLowerCase().includes(lowerQuery) ||
      book.description.toLowerCase().includes(lowerQuery) ||
      book.author.pen_name.toLowerCase().includes(lowerQuery)
  );
}
