import type { HighlightColor } from '@/lib/validations/reader-engagement';

export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'orange'];

/** Tailwind classes for each highlight color (dot / swatch / mark tint). */
export const HIGHLIGHT_COLOR_CLASSES: Record<
  HighlightColor,
  { swatch: string; dot: string; mark: string; label: string }
> = {
  yellow: {
    swatch: 'bg-yellow-300 hover:ring-yellow-400',
    dot: 'bg-yellow-300',
    mark: 'bg-yellow-300/25',
    label: 'Yellow',
  },
  green: {
    swatch: 'bg-green-300 hover:ring-green-400',
    dot: 'bg-green-300',
    mark: 'bg-green-300/25',
    label: 'Green',
  },
  blue: {
    swatch: 'bg-blue-300 hover:ring-blue-400',
    dot: 'bg-blue-300',
    mark: 'bg-blue-300/25',
    label: 'Blue',
  },
  pink: {
    swatch: 'bg-pink-300 hover:ring-pink-400',
    dot: 'bg-pink-300',
    mark: 'bg-pink-300/25',
    label: 'Pink',
  },
  orange: {
    swatch: 'bg-orange-300 hover:ring-orange-400',
    dot: 'bg-orange-300',
    mark: 'bg-orange-300/25',
    label: 'Orange',
  },
};
