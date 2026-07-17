import { formatCurrency, formatCurrencyCompact, parseCurrency } from '@/lib/utils/currency';
import { formatDuration, formatNumber, truncateText } from '@/lib/utils/format';
import { getOptimizedImageUrl, validateImageFile } from '@/lib/utils/image-utils';
import { cn } from '@/lib/utils/cn';

describe('utility helpers', () => {
  it('formats, compacts, and parses currency values stored as cents', () => {
    expect(formatCurrency(12345)).toBe('$123.45');
    expect(formatCurrencyCompact(150000)).toBe('$1.5K');
    expect(formatCurrencyCompact(250000000)).toBe('$2.5M');
    expect(parseCurrency('$1,234.56')).toBe(123456);
  });

  it('formats numbers, durations, and truncates text predictably', () => {
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(2500000)).toBe('2.5M');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('longer than max', 6)).toBe('longer...');
  });

  it('merges conflicting Tailwind classes with later classes winning', () => {
    expect(cn('px-2 py-1', false && 'hidden', ['px-4', 'text-sm'])).toBe('py-1 px-4 text-sm');
  });

  it('builds optimized image URLs only when dimensions are provided', () => {
    expect(getOptimizedImageUrl('https://cdn.example/cover.jpg')).toBe(
      'https://cdn.example/cover.jpg'
    );
    expect(getOptimizedImageUrl('https://cdn.example/cover.jpg', 320)).toBe(
      'https://cdn.example/cover.jpg?w=320&h=auto'
    );
    expect(getOptimizedImageUrl('https://cdn.example/cover.jpg', undefined, 480)).toBe(
      'https://cdn.example/cover.jpg?w=auto&h=480'
    );
  });

  it('validates image file type and size', () => {
    expect(validateImageFile(new File(['x'], 'cover.png', { type: 'image/png' }))).toEqual({
      valid: true,
    });
    expect(validateImageFile(new File(['x'], 'cover.txt', { type: 'text/plain' }))).toEqual({
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.',
    });

    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    });
    expect(validateImageFile(tooLarge)).toEqual({
      valid: false,
      error: 'File size must be less than 5MB.',
    });
  });
});
