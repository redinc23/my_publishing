/**
 * Unit tests for format utilities
 */
import {
  formatDate,
  formatPrice,
  formatRelativeTime,
  formatNumber,
  truncateText,
  formatDuration,
} from '@/lib/utils/format';

describe('Format Utilities', () => {
  describe('formatDate', () => {
    it('formats date as readable string', () => {
      const date = new Date('2024-06-15T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted).toBe('June 15, 2024');
    });

    it('handles ISO date strings', () => {
      const formatted = formatDate('2024-06-15');
      expect(formatted).toBeDefined();
      expect(formatted).toContain('2024');
    });

    it('formats with default locale', () => {
      const date = new Date('2024-12-25');
      const formatted = formatDate(date);
      expect(formatted).toBe('December 25, 2024');
    });
  });

  describe('formatPrice', () => {
    it('formats numbers as USD by default', () => {
      expect(formatPrice(10)).toBe('$10.00');
      expect(formatPrice(99.99)).toBe('$99.99');
    });

    it('handles large amounts', () => {
      const formatted = formatPrice(1234567.89);
      expect(formatted).toContain('1,234,567.89');
    });

    it('handles zero', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('formats decimals correctly', () => {
      expect(formatPrice(10.5)).toBe('$10.50');
      expect(formatPrice(10.1)).toBe('$10.10');
    });
  });

  describe('formatRelativeTime', () => {
    it('shows "just now" for recent times', () => {
      const now = new Date();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('shows minutes for times within an hour', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('shows hours for times within a day', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });

    it('shows days for times within a week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('shows full date for times over a week ago', () => {
      const longAgo = new Date('2024-01-01');
      const formatted = formatRelativeTime(longAgo);
      expect(formatted).toContain('2024');
    });
  });

  describe('formatNumber', () => {
    it('formats small numbers as-is', () => {
      expect(formatNumber(5)).toBe('5');
      expect(formatNumber(999)).toBe('999');
    });

    it('formats thousands with K suffix', () => {
      expect(formatNumber(1000)).toBe('1.0K');
      expect(formatNumber(5500)).toBe('5.5K');
      expect(formatNumber(999000)).toBe('999.0K');
    });

    it('formats millions with M suffix', () => {
      expect(formatNumber(1000000)).toBe('1.0M');
      expect(formatNumber(5500000)).toBe('5.5M');
    });
  });

  describe('truncateText', () => {
    it('truncates text longer than max length', () => {
      const text = 'This is a long text';
      expect(truncateText(text, 10)).toBe('This is a ...');
    });

    it('does not truncate text shorter than max length', () => {
      const text = 'Short';
      expect(truncateText(text, 10)).toBe('Short');
    });

    it('handles exact length', () => {
      const text = 'Exactly10!';
      expect(truncateText(text, 10)).toBe('Exactly10!');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds only', () => {
      expect(formatDuration(45)).toBe('0:45');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2:05');
      expect(formatDuration(600)).toBe('10:00');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3665)).toBe('1:01:05');
      expect(formatDuration(7200)).toBe('2:00:00');
    });

    it('pads single digits correctly', () => {
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(3605)).toBe('1:00:05');
    });
  });
});
