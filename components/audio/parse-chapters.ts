/**
 * Tolerant parser for audiobook chapter metadata.
 *
 * `book_content.toc` is free-form JSONB with no enforced shape, so this accepts
 * every plausible variant and returns [] when no time-coded chapters exist
 * (the chapter UI then simply stays hidden — graceful degradation).
 *
 * Accepted shapes:
 *   [{ title, start }, ...]                     — start in seconds
 *   [{ title, start_time|offset|time|seconds }]
 *   [{ name|label|chapter, ... }]
 *   [{ title, start: "12:34" | "1:02:34" }]     — clock strings
 *   { chapters: [...] } / { items: [...] } / { sections: [...] }
 */

import type { AudioChapter } from './types';

function parseTimeValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    // Plain numeric string → seconds.
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    // Clock string "mm:ss" or "hh:mm:ss".
    const parts = trimmed.split(':');
    if (parts.length >= 2 && parts.length <= 3 && parts.every((p) => /^\d+(\.\d+)?$/.test(p))) {
      const nums = parts.map(Number);
      let seconds = 0;
      for (const n of nums) seconds = seconds * 60 + n;
      return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
    }
  }
  return null;
}

function pickTime(entry: Record<string, unknown>): number | null {
  const keys = ['start', 'start_time', 'startTime', 'offset', 'time', 'seconds', 'position'];
  for (const key of keys) {
    if (key in entry) {
      const parsed = parseTimeValue(entry[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function pickTitle(entry: Record<string, unknown>, index: number): string {
  const keys = ['title', 'name', 'label', 'chapter', 'heading'];
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return `Chapter ${index + 1}`;
}

function asArray(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    for (const key of ['chapters', 'items', 'sections', 'tracks', 'entries']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return null;
}

export function parseChapters(toc: unknown): AudioChapter[] {
  const items = asArray(toc);
  if (!items || items.length === 0) return [];

  const chapters: AudioChapter[] = [];
  items.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const entry = raw as Record<string, unknown>;
    const start = pickTime(entry);
    if (start === null) return; // No seek target → not a playable chapter.
    const end = parseTimeValue(entry.end ?? entry.end_time ?? entry.endTime);
    chapters.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `ch-${index}`,
      title: pickTitle(entry, index),
      start,
      end: end !== null && end > start ? end : undefined,
    });
  });

  chapters.sort((a, b) => a.start - b.start);
  return chapters;
}

/** Index of the chapter containing `position`, or -1 when before the first. */
export function chapterIndexAt(chapters: AudioChapter[], position: number): number {
  let index = -1;
  for (let i = 0; i < chapters.length; i += 1) {
    if (chapters[i].start <= position) index = i;
    else break;
  }
  return index;
}

/** End of the given chapter: explicit end → next start → media duration. */
export function chapterEnd(
  chapters: AudioChapter[],
  index: number,
  duration: number
): number | null {
  if (index < 0 || index >= chapters.length) return null;
  const chapter = chapters[index];
  if (typeof chapter.end === 'number') return chapter.end;
  const next = chapters[index + 1];
  if (next) return next.start;
  return duration > 0 ? duration : null;
}
