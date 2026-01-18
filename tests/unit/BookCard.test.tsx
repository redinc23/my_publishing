import { render, screen } from '@testing-library/react';
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';

const mockBook: BookWithAuthor = {
  id: '123',
  isbn: null,
  title: 'Test Book',
  slug: 'test-book',
  description: 'A test book description',
  cover_url: 'https://example.com/cover.jpg',
  trailer_vimeo_id: null,
  genre: 'fiction',
  price: 9.99,
  discount_price: null,
  status: 'published',
  is_featured: false,
  total_reads: 100,
  average_rating: 4.5,
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author: {
    id: '456',
    pen_name: 'Test Author',
    profile_id: '789',
    bio: null,
    is_verified: false,
    total_books: 1,
    royalty_rate: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: {
      id: '789',
      user_id: 'user-123',
      email: 'author@test.com',
      full_name: 'Test Author',
      role: 'author',
      subscription_tier: 'free',
      preferences: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
};

describe('BookCard', () => {
  it('renders book title', () => {
    render(<BookCard book={mockBook} />);
    expect(screen.getByText('Test Book')).toBeInTheDocument();
  });

  it('renders author name', () => {
    render(<BookCard book={mockBook} />);
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });

  it('shows featured badge when is_featured is true', () => {
    const featuredBook = { ...mockBook, is_featured: true };
    render(<BookCard book={featuredBook} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('displays price correctly', () => {
    render(<BookCard book={mockBook} />);
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });

  it('shows discount price when available', () => {
    const discountedBook = { ...mockBook, discount_price: 7.99 };
    render(<BookCard book={discountedBook} />);
    expect(screen.getByText('$7.99')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });
});
