'use client';

/**
 * MiniPlayer — persistent bottom bar mirroring the global audio engine.
 *
 * Renders nothing unless (a) an AudioPlayerProvider is mounted and (b) a track
 * is loaded. Expand jumps to the full player page; close stops and clears.
 *
 * WIRING (root layout owner — one-time, two lines):
 *   In app/providers.tsx (preferred — already the client boundary):
 *     import { AudioPlayerProvider } from '@/components/audio/AudioContext';
 *     import { MiniPlayer } from '@/components/audio/MiniPlayer';
 *     …
 *     <AuthProvider>
 *       <AudioPlayerProvider>
 *         {children}
 *         <MiniPlayer />
 *       </AudioPlayerProvider>
 *       <ToastProvider />
 *     </AuthProvider>
 *   The bar is fixed and overlays content; consider `pb-20` on the page
 *   container while a track is active (or accept overlay — it is dismissable).
 */

import Link from 'next/link';
import { Headphones, Loader2, Maximize2, Pause, Play, RotateCcw, RotateCw, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAudio } from './AudioContext';
import { formatTime } from './format';

export function MiniPlayer() {
  const engine = useAudio();

  if (!engine || !engine.track) return null;

  const { track } = engine;
  const playedFraction = engine.duration > 0 ? engine.currentTime / engine.duration : 0;
  const expandHref = track.bookId ? `/audio/${track.bookId}` : '/audio';
  const subtitle = track.narrator
    ? `Narrated by ${track.narrator}`
    : (track.author ?? 'MANGU Audiobooks');

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      role="region"
      aria-label="Now playing"
    >
      {/* Hairline progress */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-300"
          style={{ width: `${playedFraction * 100}%` }}
        />
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* Cover + title */}
        {track.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.coverUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded object-cover"
            aria-hidden="true"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-muted">
            <Headphones className="h-5 w-5 text-secondary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{track.title ?? 'Audiobook'}</p>
          <p className="truncate text-xs text-secondary">{subtitle}</p>
        </div>

        {/* Time (desktop only) */}
        <span className="hidden text-xs tabular-nums text-secondary md:block">
          {formatTime(engine.currentTime)} / {formatTime(engine.duration)}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => engine.seekBy(-15)}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Back 15 seconds"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => engine.toggle()}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white',
              'transition-transform hover:scale-105'
            )}
            aria-label={engine.isPlaying ? 'Pause' : 'Play'}
          >
            {engine.isBuffering ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : engine.isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={() => engine.seekBy(15)}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Forward 15 seconds"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        {/* Expand + close */}
        <Link
          href={expandHref}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Open full player"
          title="Open full player"
        >
          <Maximize2 className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={() => engine.stop()}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Stop and close player"
          title="Stop and close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
