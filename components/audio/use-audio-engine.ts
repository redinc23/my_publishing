'use client';

/**
 * useAudioEngine — the single source of truth for audio playback.
 *
 * One engine instance drives one <audio> element. The global instance lives in
 * AudioContext (components/audio/AudioContext.tsx); AudioPlayer falls back to a
 * private instance when no provider is wired, so every player works standalone.
 *
 * Features: speed 0.5–3x, volume/mute, buffered tracking, sleep timer
 * (minutes / end-of-chapter), progress persistence (localStorage always +
 * listening_progress sync when signed in), Media Session integration.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/hooks/use-toast';
import type { AudioChapter, AudioEngine, AudioTrackInfo, SleepTimerState } from './types';
import { chapterEnd, chapterIndexAt } from './parse-chapters';
import {
  clearLocalProgress,
  fetchServerProgress,
  isResumable,
  progressKey,
  putServerProgress,
  readLocalProgress,
  readPrefs,
  writeLocalProgress,
  writePrefs,
} from './progress-store';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;

const LOCAL_WRITE_INTERVAL_MS = 1_000;
const SERVER_WRITE_INTERVAL_MS = 5_000;
const SEEK_STEP_SEC = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeDuration(raw: number): number {
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function useAudioEngine(): AudioEngine {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [track, setTrack] = useState<AudioTrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasMetadata, setHasMetadata] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedFraction, setBufferedFraction] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState | null>(null);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [serverSyncEnabled, setServerSyncEnabled] = useState(true);

  // Ref mirrors for event handlers (avoid stale closures).
  const trackRef = useRef<AudioTrackInfo | null>(null);
  const durationRef = useRef(0);
  const sleepTimerRef = useRef<SleepTimerState | null>(null);
  const serverDisabledRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(false);
  const lastLocalWriteRef = useRef<number>(0);
  const lastServerWriteRef = useRef<number>(0);
  const errorToastedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const resumePositionRef = useRef<number | null>(null);

  trackRef.current = track;
  durationRef.current = duration;
  sleepTimerRef.current = sleepTimer;

  // Hydrate persisted prefs after mount (client-only; avoids hydration drift).
  useEffect(() => {
    const prefs = readPrefs();
    if (!prefs) return;
    setVolumeState(prefs.volume);
    setPlaybackRateState(prefs.playbackRate);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = prefs.volume;
      audio.playbackRate = prefs.playbackRate;
    }
  }, []);

  const markServerDisabled = useCallback(() => {
    serverDisabledRef.current = true;
    setServerSyncEnabled(false);
  }, []);

  const persist = useCallback(
    (opts?: { force?: boolean; keepalive?: boolean }) => {
      const audio = audioRef.current;
      const current = trackRef.current;
      if (!current) return;
      const position = audio?.currentTime ?? 0;
      const dur = safeDuration(audio?.duration ?? 0);
      const now = Date.now();
      const key = progressKey(current);

      if (opts?.force || now - lastLocalWriteRef.current >= LOCAL_WRITE_INTERVAL_MS) {
        lastLocalWriteRef.current = now;
        writeLocalProgress(key, { position, duration: dur, updatedAt: now });
      }

      if (!current.bookId || serverDisabledRef.current) return;
      if (!opts?.force && now - lastServerWriteRef.current < SERVER_WRITE_INTERVAL_MS) return;
      lastServerWriteRef.current = now;
      void putServerProgress(current.bookId, position, dur, { keepalive: opts?.keepalive }).then(
        (result) => {
          if (result === 'unauthenticated' || result === 'disabled') markServerDisabled();
        }
      );
    },
    [markServerDisabled]
  );

  const clearSleepTimer = useCallback(() => {
    sleepTimerRef.current = null;
    setSleepTimer(null);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) return;
    // Pressing play with a pending resume prompt implies "resume".
    if (resumePositionRef.current !== null) {
      try {
        audio.currentTime = resumePositionRef.current;
        setCurrentTime(resumePositionRef.current);
      } catch {
        /* metadata not ready — seek applied on load */
      }
      resumePositionRef.current = null;
      setResumePosition(null);
    }
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        // Autoplay restrictions / interrupted loads are non-fatal.
        setIsPlaying(false);
      });
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) return;
    const max = safeDuration(audio.duration);
    const target = clamp(seconds, 0, max > 0 ? max : Number.MAX_SAFE_INTEGER);
    try {
      audio.currentTime = target;
      setCurrentTime(target);
    } catch {
      pendingSeekRef.current = target;
    }
  }, []);

  /** Resolve the best saved position for a track (local now, server async). */
  const resolveSavedPosition = useCallback(
    (target: AudioTrackInfo, onResolved: (position: number | null) => void) => {
      const local = readLocalProgress(progressKey(target));
      const localPos = isResumable(local) && local ? local.position : null;

      if (!target.bookId || serverDisabledRef.current) {
        onResolved(localPos);
        return;
      }

      // Answer immediately with local; upgrade when the server replies newer.
      onResolved(localPos);
      void fetchServerProgress(target.bookId).then((result) => {
        if (result.kind === 'unauthenticated' || result.kind === 'disabled') {
          markServerDisabled();
          return;
        }
        if (result.kind !== 'ok') return;
        if (trackRef.current?.src !== target.src) return; // user moved on
        const serverPos =
          result.progress && isResumable(result.progress) ? result.progress.position : null;
        if (serverPos === null) return;
        const localUpdated = local?.updatedAt ?? 0;
        if ((result.progress?.updatedAt ?? 0) > localUpdated) {
          onResolved(serverPos);
        }
      });
    },
    [markServerDisabled]
  );

  const loadTrack = useCallback(
    (next: AudioTrackInfo, opts?: { autoplay?: boolean }) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Same track already loaded → merge metadata, don't disturb playback.
      if (trackRef.current?.src === next.src) {
        setTrack({
          ...trackRef.current,
          ...next,
          chapters: next.chapters ?? trackRef.current.chapters,
        });
        if (opts?.autoplay) play();
        return;
      }

      persist({ force: true });
      audio.pause();

      const chapters: AudioChapter[] = (next.chapters ?? [])
        .slice()
        .sort((a, b) => a.start - b.start);
      const merged: AudioTrackInfo = { ...next, chapters };
      setTrack(merged);
      setIsPlaying(false);
      setIsBuffering(false);
      setHasMetadata(false);
      setCurrentTime(0);
      setDuration(0);
      setBufferedFraction(0);
      resumePositionRef.current = null;
      setResumePosition(null);
      clearSleepTimer();
      errorToastedRef.current = false;
      pendingSeekRef.current = null;
      pendingPlayRef.current = false;
      hasStartedRef.current = false;

      resolveSavedPosition(merged, (position) => {
        if (trackRef.current?.src !== merged.src) return;
        if (opts?.autoplay) {
          // Explicit play intent → resume silently at the saved spot. Only the
          // synchronous (local) resolution is applied; playback has already
          // started by the time any server answer arrives.
          if (position !== null && position > 0 && !hasStartedRef.current) {
            pendingSeekRef.current = position;
            try {
              audio.currentTime = position;
              setCurrentTime(position);
            } catch {
              /* applied on loadedmetadata */
            }
          }
        } else if (position !== null && position > 0) {
          resumePositionRef.current = position;
          setResumePosition(position);
        }
      });

      audio.src = merged.src;
      audio.load();

      if (opts?.autoplay) {
        pendingPlayRef.current = true;
        hasStartedRef.current = true;
        play();
      }
    },
    [clearSleepTimer, persist, play, resolveSavedPosition]
  );

  const playTrack = useCallback(
    (next: AudioTrackInfo) => {
      loadTrack(next, { autoplay: true });
    },
    [loadTrack]
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) return;
    if (audio.paused) play();
    else pause();
  }, [pause, play]);

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      seekTo(audio.currentTime + deltaSeconds);
    },
    [seekTo]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    const next = clamp(rate, 0.5, 3);
    setPlaybackRateState(next);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = next;
    writePrefs({ volume: audio?.volume ?? 1, playbackRate: next });
  }, []);

  const setVolume = useCallback((value: number) => {
    const next = clamp(value, 0, 1);
    setVolumeState(next);
    setIsMuted(next === 0);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = next;
      audio.muted = next === 0;
    }
    writePrefs({ volume: next, playbackRate: audio?.playbackRate ?? 1 });
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const setSleepTimerMinutes = useCallback((minutes: number) => {
    const endsAt = Date.now() + minutes * 60_000;
    const state: SleepTimerState = {
      mode: 'minutes',
      endsAt,
      remainingSec: minutes * 60,
    };
    sleepTimerRef.current = state;
    setSleepTimer(state);
    toast({ title: `Sleep timer set for ${minutes} minutes` });
  }, []);

  const setSleepTimerEndOfChapter = useCallback(() => {
    const chapters = trackRef.current?.chapters ?? [];
    if (chapters.length === 0) {
      toast({ title: 'No chapters in this audiobook — pick a time instead' });
      return;
    }
    const state: SleepTimerState = { mode: 'chapter', remainingSec: null };
    sleepTimerRef.current = state;
    setSleepTimer(state);
    toast({ title: 'Playback will pause at the end of this chapter' });
  }, []);

  const cancelSleepTimer = useCallback(() => {
    clearSleepTimer();
    toast({ title: 'Sleep timer cleared' });
  }, [clearSleepTimer]);

  const applyResume = useCallback(
    (autoplay = true) => {
      const position = resumePositionRef.current;
      if (position !== null) seekTo(position);
      resumePositionRef.current = null;
      setResumePosition(null);
      if (autoplay) play();
    },
    [play, seekTo]
  );

  const dismissResume = useCallback(() => {
    const current = trackRef.current;
    if (current) clearLocalProgress(progressKey(current));
    seekTo(0);
    resumePositionRef.current = null;
    setResumePosition(null);
  }, [seekTo]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    persist({ force: true });
    clearSleepTimer();
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setTrack(null);
    setIsPlaying(false);
    setIsBuffering(false);
    setHasMetadata(false);
    setCurrentTime(0);
    setDuration(0);
    setBufferedFraction(0);
    resumePositionRef.current = null;
    setResumePosition(null);
  }, [clearSleepTimer, persist]);

  // ── <audio> event wiring ────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const dur = safeDuration(audio.duration);
      setDuration(dur);
      setHasMetadata(true);
      if (pendingSeekRef.current !== null) {
        const target = clamp(pendingSeekRef.current, 0, dur > 0 ? dur : Number.MAX_SAFE_INTEGER);
        try {
          audio.currentTime = target;
          setCurrentTime(target);
        } catch {
          /* ignore */
        }
        pendingSeekRef.current = null;
      }
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        const attempt = audio.play();
        if (attempt && typeof attempt.catch === 'function') {
          attempt.catch(() => setIsPlaying(false));
        }
      }
    };

    const onTimeUpdate = () => {
      const now = Date.now();
      setCurrentTime(audio.currentTime);

      // Sleep timer checks.
      const sleep = sleepTimerRef.current;
      if (sleep) {
        if (sleep.mode === 'minutes' && now >= sleep.endsAt) {
          clearSleepTimer();
          audio.pause();
          toast({ title: 'Sleep timer ended — good night' });
        } else if (sleep.mode === 'chapter') {
          const chapters = trackRef.current?.chapters ?? [];
          const idx = chapterIndexAt(chapters, audio.currentTime);
          const end = chapterEnd(chapters, idx, safeDuration(audio.duration));
          if (end !== null && audio.currentTime >= end - 0.4) {
            clearSleepTimer();
            audio.pause();
            toast({ title: 'Paused at the end of the chapter' });
          }
        }
      }

      persist();
    };

    const onProgress = () => {
      try {
        const dur = safeDuration(audio.duration);
        if (dur <= 0 || audio.buffered.length === 0) return;
        // Largest buffered end is the best "downloaded" proxy.
        let bufferedEnd = 0;
        for (let i = 0; i < audio.buffered.length; i += 1) {
          bufferedEnd = Math.max(bufferedEnd, audio.buffered.end(i));
        }
        setBufferedFraction(clamp(bufferedEnd / dur, 0, 1));
      } catch {
        /* ignore */
      }
    };

    const onPlay = () => {
      hasStartedRef.current = true;
      setIsPlaying(true);
    };
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    const onWaiting = () => setIsBuffering(true);
    const onStalled = () => setIsBuffering(true);

    const onPause = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      persist({ force: true });
    };

    const onEnded = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      clearSleepTimer();
      persist({ force: true });
    };

    const onError = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      if (!errorToastedRef.current && trackRef.current) {
        errorToastedRef.current = true;
        toast({
          title: 'Audio failed to load. Check your connection and try again.',
          variant: 'destructive',
        });
      }
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [clearSleepTimer, persist]);

  // Flush progress when the tab hides / closes.
  useEffect(() => {
    const flush = () => persist({ force: true, keepalive: true });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [persist]);

  // Sleep-timer countdown tick (1s while a minutes timer is armed).
  const sleepEndsAt = sleepTimer && sleepTimer.mode === 'minutes' ? sleepTimer.endsAt : null;
  useEffect(() => {
    if (sleepEndsAt === null) return;
    const interval = window.setInterval(() => {
      const current = sleepTimerRef.current;
      if (!current || current.mode !== 'minutes') return;
      const remainingSec = Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000));
      setSleepTimer({ ...current, remainingSec });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [sleepEndsAt]);

  // Media Session (lock screen / OS controls) — best effort. Only the engine
  // that last published metadata may clear it, so a dormant standalone engine
  // never wipes the shared engine's lock-screen info.
  const ownsMediaSessionRef = useRef(false);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      if (track) {
        ownsMediaSessionRef.current = true;
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title ?? 'Audiobook',
          artist: track.narrator ?? track.author ?? 'MANGU Publishers',
          album: 'MANGU Audiobooks',
          artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512' }] : [],
        });
        navigator.mediaSession.setActionHandler('play', () => play());
        navigator.mediaSession.setActionHandler('pause', () => pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-SEEK_STEP_SEC));
        navigator.mediaSession.setActionHandler('seekforward', () => seekBy(SEEK_STEP_SEC));
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          const chapters = track.chapters ?? [];
          const idx = chapterIndexAt(chapters, audioRef.current?.currentTime ?? 0);
          if (idx > 0) seekTo(chapters[idx - 1].start);
          else if (idx === 0) seekTo(chapters[0].start);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          const chapters = track.chapters ?? [];
          const idx = chapterIndexAt(chapters, audioRef.current?.currentTime ?? 0);
          if (idx >= 0 && idx < chapters.length - 1) seekTo(chapters[idx + 1].start);
        });
      } else if (ownsMediaSessionRef.current) {
        ownsMediaSessionRef.current = false;
        navigator.mediaSession.metadata = null;
      }
    } catch {
      /* older browsers — cosmetic only */
    }
  }, [track, play, pause, seekBy, seekTo]);

  const activeChapterIndex = chapterIndexAt(track?.chapters ?? [], currentTime);

  return {
    audioRef,
    track,
    isPlaying,
    isBuffering,
    hasMetadata,
    currentTime,
    duration,
    bufferedFraction,
    playbackRate,
    volume,
    isMuted,
    sleepTimer,
    chapters: track?.chapters ?? [],
    activeChapterIndex,
    resumePosition,
    serverSyncEnabled,
    loadTrack,
    playTrack,
    play,
    pause,
    toggle,
    seekTo,
    seekBy,
    setPlaybackRate,
    setVolume,
    toggleMute,
    setSleepTimerMinutes,
    setSleepTimerEndOfChapter,
    cancelSleepTimer,
    applyResume,
    dismissResume,
    stop,
  };
}
