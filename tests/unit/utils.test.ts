/**
 * Unit tests for utility functions
 */
import { formatDate, formatCurrency, truncate, generateSlug, debounce } from '@/lib/utils';

describe('Utility Functions', () => {
  describe('formatDate', () => {
    it('formats a date string correctly', () => {
      const date = '2024-01-15';
      const formatted = formatDate(date);
      expect(formatted).toBe('January 15, 2024');
    });

    it('formats a Date object correctly', () => {
      const date = new Date('2024-12-25');
      const formatted = formatDate(date);
      expect(formatted).toBe('December 25, 2024');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency by default', () => {
      expect(formatCurrency(10.99)).toBe('$10.99');
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('formats other currencies when specified', () => {
      expect(formatCurrency(10.99, 'EUR')).toContain('10.99');
      expect(formatCurrency(10.99, 'GBP')).toContain('10.99');
    });

    it('handles zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles large numbers', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });
  });

  describe('truncate', () => {
    it('truncates text longer than specified length', () => {
      const text = 'This is a long text that needs truncation';
      expect(truncate(text, 10)).toBe('This is a ...');
    });

    it('does not truncate text shorter than specified length', () => {
      const text = 'Short';
      expect(truncate(text, 10)).toBe('Short');
    });

    it('handles exact length correctly', () => {
      const text = 'Exactly10!';
      expect(truncate(text, 10)).toBe('Exactly10!');
    });

    it('handles empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });
  });

  describe('generateSlug', () => {
    it('converts title to lowercase slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(generateSlug('Hello! World?')).toBe('hello-world');
    });

    it('handles multiple spaces', () => {
      expect(generateSlug('Hello    World')).toBe('hello-world');
    });

    it('removes leading and trailing hyphens', () => {
      expect(generateSlug('  Hello World  ')).toBe('hello-world');
    });

    it('handles underscores and hyphens', () => {
      expect(generateSlug('hello_world-test')).toBe('hello-world-test');
    });

    it('handles unicode characters', () => {
      expect(generateSlug('Café au Lait')).toBe('caf-au-lait');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('delays function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('cancels previous calls when called multiple times', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test', 123);
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('test', 123);
    });
  });
});
