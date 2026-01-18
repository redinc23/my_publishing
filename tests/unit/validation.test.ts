/**
 * Unit tests for validation schemas
 */
import { emailSchema, passwordSchema, bookSchema, manuscriptSchema } from '@/lib/utils/validation';

describe('Validation Schemas', () => {
  describe('emailSchema', () => {
    it('validates correct email addresses', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow();
      expect(() => emailSchema.parse('user.name@domain.co.uk')).not.toThrow();
      expect(() => emailSchema.parse('user+tag@example.com')).not.toThrow();
    });

    it('rejects invalid email addresses', () => {
      expect(() => emailSchema.parse('invalid')).toThrow('Invalid email address');
      expect(() => emailSchema.parse('test@')).toThrow();
      expect(() => emailSchema.parse('@example.com')).toThrow();
      expect(() => emailSchema.parse('')).toThrow();
    });
  });

  describe('passwordSchema', () => {
    it('validates passwords of correct length', () => {
      expect(() => passwordSchema.parse('123456')).not.toThrow();
      expect(() => passwordSchema.parse('a'.repeat(50))).not.toThrow();
      expect(() => passwordSchema.parse('a'.repeat(100))).not.toThrow();
    });

    it('rejects passwords that are too short', () => {
      expect(() => passwordSchema.parse('12345')).toThrow(
        'Password must be at least 6 characters'
      );
      expect(() => passwordSchema.parse('')).toThrow();
    });

    it('rejects passwords that are too long', () => {
      expect(() => passwordSchema.parse('a'.repeat(101))).toThrow(
        'Password must be less than 100 characters'
      );
    });
  });

  describe('bookSchema', () => {
    const validBook = {
      title: 'Test Book',
      slug: 'test-book',
      genre: 'Fiction',
      price: 9.99,
    };

    it('validates a complete book object', () => {
      expect(() => bookSchema.parse(validBook)).not.toThrow();
    });

    it('validates book with optional description', () => {
      expect(() =>
        bookSchema.parse({
          ...validBook,
          description: 'A great book',
        })
      ).not.toThrow();
    });

    it('validates book with zero price', () => {
      expect(() =>
        bookSchema.parse({
          ...validBook,
          price: 0,
        })
      ).not.toThrow();
    });

    it('rejects book without required fields', () => {
      expect(() => bookSchema.parse({})).toThrow();
      expect(() => bookSchema.parse({ title: 'Test' })).toThrow();
    });

    it('rejects book with empty title', () => {
      expect(() =>
        bookSchema.parse({
          ...validBook,
          title: '',
        })
      ).toThrow('Title is required');
    });

    it('rejects book with negative price', () => {
      expect(() =>
        bookSchema.parse({
          ...validBook,
          price: -1,
        })
      ).toThrow('Price must be positive');
    });
  });

  describe('manuscriptSchema', () => {
    const validManuscript = {
      title: 'My Manuscript',
      genre: 'Fantasy',
    };

    it('validates a minimal manuscript object', () => {
      expect(() => manuscriptSchema.parse(validManuscript)).not.toThrow();
    });

    it('validates manuscript with optional fields', () => {
      expect(() =>
        manuscriptSchema.parse({
          ...validManuscript,
          synopsis: 'A great story',
          word_count: 50000,
        })
      ).not.toThrow();
    });

    it('rejects manuscript without required fields', () => {
      expect(() => manuscriptSchema.parse({})).toThrow();
      expect(() => manuscriptSchema.parse({ title: 'Test' })).toThrow();
    });

    it('rejects manuscript with empty title', () => {
      expect(() =>
        manuscriptSchema.parse({
          ...validManuscript,
          title: '',
        })
      ).toThrow('Title is required');
    });

    it('rejects manuscript with synopsis too long', () => {
      expect(() =>
        manuscriptSchema.parse({
          ...validManuscript,
          synopsis: 'a'.repeat(1001),
        })
      ).toThrow('Synopsis must be less than 1000 characters');
    });

    it('rejects manuscript with invalid word_count', () => {
      expect(() =>
        manuscriptSchema.parse({
          ...validManuscript,
          word_count: 0,
        })
      ).toThrow();
    });
  });
});
