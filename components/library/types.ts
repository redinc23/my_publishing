import type { BookWithAuthor } from '@/types';

/**
 * View-model for the Cinema Library experience.
 *
 * Built on the server (app/(consumer)/library/page.tsx) from the user's
 * completed orders plus their reading_progress rows, and passed to the
 * client tree as plain JSON-serializable data.
 */
export interface LibraryProgress {
  /** Reader progress — historically stored as a 0..1 fraction, currently 0..100. */
  currentPosition: number;
  isFinished: boolean;
  lastAccessed?: string;
}

export interface LibraryItem {
  book: BookWithAuthor;
  orderNumber: string;
  /** ISO timestamp of the order that granted this item. */
  purchasedAt: string;
  progress?: LibraryProgress;
}

/**
 * Convert a stored reading position to a whole 0..100 percentage.
 * Tolerates both storage conventions: 0..1 fractions and raw 0..100 values.
 */
export function toProgressPercent(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0;
  const percent = position <= 1 ? position * 100 : position;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

/** Author display name — same fallback chain as BookCard. */
export function getAuthorName(book: BookWithAuthor): string {
  return (
    book.author?.profile?.full_name ||
    book.author?.pen_name ||
    book.author?.full_name ||
    'Unknown Author'
  );
}
