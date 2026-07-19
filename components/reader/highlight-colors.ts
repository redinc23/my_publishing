import type { HighlightColor } from '@/lib/validations/reader-engagement';

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  'yellow',
  'green',
  'blue',
  'pink',
  'orange',
] as const;

export const HIGHLIGHT_COLOR_CLASSES: Record<
  HighlightColor,
  { label: string; dot: string; mark: string; swatch: string }
> = {
  yellow: {
    label: 'Yellow',
    dot: 'bg-yellow-400',
    mark: 'bg-yellow-200/70 text-yellow-950 dark:bg-yellow-400/25 dark:text-yellow-50',
    swatch: 'bg-yellow-400 ring-yellow-500',
  },
  green: {
    label: 'Green',
    dot: 'bg-emerald-400',
    mark: 'bg-emerald-200/70 text-emerald-950 dark:bg-emerald-400/25 dark:text-emerald-50',
    swatch: 'bg-emerald-400 ring-emerald-500',
  },
  blue: {
    label: 'Blue',
    dot: 'bg-sky-400',
    mark: 'bg-sky-200/70 text-sky-950 dark:bg-sky-400/25 dark:text-sky-50',
    swatch: 'bg-sky-400 ring-sky-500',
  },
  pink: {
    label: 'Pink',
    dot: 'bg-pink-400',
    mark: 'bg-pink-200/70 text-pink-950 dark:bg-pink-400/25 dark:text-pink-50',
    swatch: 'bg-pink-400 ring-pink-500',
  },
  orange: {
    label: 'Orange',
    dot: 'bg-orange-400',
    mark: 'bg-orange-200/70 text-orange-950 dark:bg-orange-400/25 dark:text-orange-50',
    swatch: 'bg-orange-400 ring-orange-500',
  },
};
