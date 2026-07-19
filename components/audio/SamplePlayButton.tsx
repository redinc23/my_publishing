'use client';

/**
 * SamplePlayButton — one-tap play/pause for catalog cards.
 *
 * Routes through the shared engine when an AudioPlayerProvider is mounted;
 * otherwise falls back to a module-level preview <audio> singleton so the
 * catalog works even before the provider is wired in. Only one preview ever
 * plays at a time.
 */

import { useEffect, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAudio } from './AudioContext';
import type { AudioTrackInfo } from './types';

interface SamplePlayButtonProps {
  src: string;
  title?: string;
  author?: string;
  narrator?: string;
  coverUrl?: string;
  bookId?: string;
  className?: string;
}

// ── Standalone preview singleton (no-provider fallback) ──────────────────────

const PREVIEW_EVENT = 'mangu:audio-preview-change';

let previewEl: HTMLAudioElement | null = null;
let previewSrc: string | null = null;

function getPreviewEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!previewEl) {
    previewEl = new Audio();
    previewEl.preload = 'none';
    const emit = () => window.dispatchEvent(new Event(PREVIEW_EVENT));
    previewEl.addEventListener('play', emit);
    previewEl.addEventListener('pause', emit);
    previewEl.addEventListener('ended', emit);
    previewEl.addEventListener('waiting', emit);
    previewEl.addEventListener('playing', emit);
  }
  return previewEl;
}

function togglePreview(src: string): void {
  const el = getPreviewEl();
  if (!el) return;
  if (previewSrc === src && !el.paused) {
    el.pause();
    return;
  }
  if (previewSrc !== src) {
    previewSrc = src;
    el.src = src;
  }
  void el.play().catch(() => {
    window.dispatchEvent(new Event(PREVIEW_EVENT));
  });
}

export function SamplePlayButton({
  src,
  title,
  author,
  narrator,
  coverUrl,
  bookId,
  className,
}: SamplePlayButtonProps) {
  const engine = useAudio();
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Keep the fallback button in sync with the shared preview element, and stop
  // this preview if the card unmounts (no mini-player without a provider, so
  // an orphaned preview would have no UI to stop it).
  useEffect(() => {
    if (engine) return; // shared engine path has its own reactive state
    const sync = () => {
      const el = getPreviewEl();
      setPreviewPlaying(previewSrc === src && !!el && !el.paused);
    };
    sync();
    window.addEventListener(PREVIEW_EVENT, sync);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, sync);
      const el = getPreviewEl();
      if (el && previewSrc === src && !el.paused) {
        el.pause();
      }
    };
  }, [engine, src]);

  const isActive = engine ? engine.track?.src === src : previewPlaying;
  const isPlaying = engine ? isActive && engine.isPlaying : previewPlaying;
  const isBuffering = engine ? isActive && engine.isBuffering : false;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (engine) {
      const track: AudioTrackInfo = { src, title, author, narrator, coverUrl, bookId };
      if (isActive) engine.toggle();
      else engine.playTrack(track);
    } else {
      togglePreview(src);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isPlaying ? `Pause ${title ?? 'sample'}` : `Play ${title ?? 'sample'}`}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg',
        'hover:bg-primary-hover transition-all hover:scale-105 focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
    >
      {isBuffering ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isPlaying ? (
        <Pause className="h-5 w-5 fill-current" />
      ) : (
        <Play className="ml-0.5 h-5 w-5 fill-current" />
      )}
    </button>
  );
}
