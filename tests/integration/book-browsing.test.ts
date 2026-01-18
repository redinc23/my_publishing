/**
 * Integration test for book browsing and filtering
 */
import { createMockBooks, createMockBook } from '../helpers/mock-data';

describe('Book Browsing Integration', () => {
  describe('Mock data generation', () => {
    it('generates multiple books', () => {
      const books = createMockBooks(5);
      expect(books).toHaveLength(5);
      expect(books[0]).toHaveProperty('title');
      expect(books[0]).toHaveProperty('slug');
      expect(books[0]).toHaveProperty('genre');
    });

    it('generates unique book IDs', () => {
      const books = createMockBooks(3);
      const ids = books.map(b => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('creates book with custom properties', () => {
      const customBook = createMockBook({ 
        title: 'Custom Title',
        genre: 'SciFi',
        price: 15.99
      });
      
      expect(customBook.title).toBe('Custom Title');
      expect(customBook.genre).toBe('SciFi');
      expect(customBook.price).toBe(15.99);
    });
  });

  describe('Book filtering logic', () => {
    it('filters books by genre', () => {
      const allBooks = [
        createMockBook({ genre: 'Fiction' }),
        createMockBook({ genre: 'Mystery' }),
        createMockBook({ genre: 'Fiction' }),
      ];
      
      const fictionBooks = allBooks.filter(b => b.genre === 'Fiction');
      expect(fictionBooks).toHaveLength(2);
    });

    it('filters books by price range', () => {
      const allBooks = [
        createMockBook({ price: 5.99 }),
        createMockBook({ price: 10.99 }),
        createMockBook({ price: 15.99 }),
      ];
      
      const affordableBooks = allBooks.filter(b => b.price <= 10);
      expect(affordableBooks).toHaveLength(1);
    });

    it('filters books by multiple criteria', () => {
      const allBooks = [
        createMockBook({ genre: 'Fiction', price: 5.99, status: 'published' }),
        createMockBook({ genre: 'Fiction', price: 15.99, status: 'published' }),
        createMockBook({ genre: 'Mystery', price: 5.99, status: 'published' }),
        createMockBook({ genre: 'Fiction', price: 5.99, status: 'draft' }),
      ];
      
      const filtered = allBooks.filter(b => 
        b.genre === 'Fiction' && 
        b.price < 10 && 
        b.status === 'published'
      );
      
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Book search logic', () => {
    it('searches books by title', () => {
      const books = [
        createMockBook({ title: 'The Great Adventure' }),
        createMockBook({ title: 'Great Expectations' }),
        createMockBook({ title: 'Another Book' }),
      ];
      
      const searchResults = books.filter(b => 
        b.title.toLowerCase().includes('great')
      );
      
      expect(searchResults).toHaveLength(2);
    });

    it('returns empty array when no matches', () => {
      const books = createMockBooks(3);
      const searchResults = books.filter(b => 
        b.title.includes('NonExistent')
      );
      
      expect(searchResults).toHaveLength(0);
    });
  });

  describe('Pagination logic', () => {
    it('slices books for pagination', () => {
      const allBooks = createMockBooks(30);
      const page1 = allBooks.slice(0, 10);
      const page2 = allBooks.slice(10, 20);
      
      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('handles last page with fewer items', () => {
      const allBooks = createMockBooks(25);
      const lastPage = allBooks.slice(20, 30);
      
      expect(lastPage).toHaveLength(5);
    });
  });

  describe('Book sorting logic', () => {
    it('sorts books by price ascending', () => {
      const books = [
        createMockBook({ price: 15.99 }),
        createMockBook({ price: 5.99 }),
        createMockBook({ price: 10.99 }),
      ];
      
      const sorted = [...books].sort((a, b) => a.price - b.price);
      
      expect(sorted[0].price).toBe(5.99);
      expect(sorted[2].price).toBe(15.99);
    });

    it('sorts books by title alphabetically', () => {
      const books = [
        createMockBook({ title: 'Zebra' }),
        createMockBook({ title: 'Apple' }),
        createMockBook({ title: 'Mango' }),
      ];
      
      const sorted = [...books].sort((a, b) => 
        a.title.localeCompare(b.title)
      );
      
      expect(sorted[0].title).toBe('Apple');
      expect(sorted[2].title).toBe('Zebra');
    });
  });
});
