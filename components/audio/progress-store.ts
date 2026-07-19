/**
 * Progress persistence for the audio engine.
 *
 * Two layers, always best-effort and never throwing:
 *   1. localStorage — for everyone (anonymous included), keyed per book/src.
 *   2. /api/audio/progress — signed-in sync, keyed by book_id. Degrades
 *      silently when the user is anonymous, the migration is missing, or the
 *      network fails.
 */

import type { AudioTrackInfo, SavedAudioProgress } from './types';

const LOCAL_PREFIX = 'mangu:audio-progress:';
const PREFS_KEY = 'mangu:audio-prefs';

/** Minimum position worth offering a resume for (seconds). */
export const RESUME_THRESHOLD_SEC = 10;
/** Consider a track finished when within this many seconds of the end. */
export const FINISHED_THRESHOLD_SEC = 30;

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** djb2 → base36; stable key for tracks without a book id (e.g. samples). */
export function hashSrc(src: string): string {
  let hash = 5381;
  for (let i = 0; i < src.length; i += 1) {
    hash = (hash * 33) ^ src.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function progressKey(track: Pick<AudioTrackInfo, 'bookId' | 'src'>): string {
  return `${LOCAL_PREFIX}${track.bookId ?? hashSrc(track.src)}`;
}

export function readLocalProgress(key: string): SavedAudioProgress | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedAudioProgress>;
    if (typeof parsed.position !== 'number' || Number.isNaN(parsed.position)) return null;
    return {
      position: Math.max(0, parsed.position),
      duration: typeof parsed.duration === 'number' ? parsed.duration : 0,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function writeLocalProgress(key: string, progress: SavedAudioProgress): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(progress));
  } catch {
    // Quota / private-mode — persistence is best-effort.
  }
}

export function clearLocalProgress(key: string): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* best-effort */
  }
}

// ── Player preferences (volume + playback rate survive reloads) ─────────────

export interface AudioPrefs {
  volume: number;
  playbackRate: number;
}

export function readPrefs(): AudioPrefs | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : 1,
      playbackRate:
        typeof parsed.playbackRate === 'number' &&
        parsed.playbackRate >= 0.5 &&
        parsed.playbackRate <= 3
          ? parsed.playbackRate
          : 1,
    };
  } catch {
    return null;
  }
}

export function writePrefs(prefs: AudioPrefs): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort */
  }
}

// ── Server sync ─────────────────────────────────────────────────────────────

export type ServerProgressResult =
  | { kind: 'ok'; progress: SavedAudioProgress | null }
  | { kind: 'unauthenticated' }
  | { kind: 'disabled' }
  | { kind: 'error' };

export async function fetchServerProgress(bookId: string): Promise<ServerProgressResult> {
  try {
    const res = await fetch(`/api/audio/progress?book_id=${encodeURIComponent(bookId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (res.status === 401) return { kind: 'unauthenticated' };
    if (res.status === 503) return { kind: 'disabled' };
    if (!res.ok) return { kind: 'error' };
    const body = (await res.json()) as {
      status: string;
      progress?: {
        position_seconds: number;
        duration_seconds: number;
        updated_at: string;
      } | null;
    };
    if (!body.progress) return { kind: 'ok', progress: null };
    return {
      kind: 'ok',
      progress: {
        position: body.progress.position_seconds,
        duration: body.progress.duration_seconds,
        updatedAt: Date.parse(body.progress.updated_at) || 0,
      },
    };
  } catch {
    return { kind: 'error' };
  }
}

export type ServerSaveResult = 'ok' | 'unauthenticated' | 'disabled' | 'error';

export async function putServerProgress(
  bookId: string,
  position: number,
  duration: number,
  opts?: { keepalive?: boolean }
): Promise<ServerSaveResult> {
  try {
    const res = await fetch('/api/audio/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      keepalive: opts?.keepalive ?? false,
      body: JSON.stringify({
        book_id: bookId,
        position_seconds: Math.max(0, Math.floor(position)),
        duration_seconds: Math.max(0, Math.floor(duration)),
      }),
    });
    if (res.status === 401) return 'unauthenticated';
    if (res.status === 503) return 'disabled';
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

/** Should we offer a resume prompt for this saved snapshot? */
export function isResumable(saved: SavedAudioProgress | null): boolean {
  if (!saved) return false;
  if (saved.position < RESUME_THRESHOLD_SEC) return false;
  if (saved.duration > 0 && saved.position >= saved.duration - FINISHED_THRESHOLD_SEC) {
    return false;
  }
  return true;
}
