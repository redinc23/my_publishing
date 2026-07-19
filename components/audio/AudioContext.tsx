'use client';

/**
 * Global audio context — one shared engine + one hidden <audio> element so a
 * book keeps playing while the reader browses the catalog.
 *
 * The provider is OPTIONAL: AudioPlayer / SamplePlayButton detect its absence
 * (useAudio() → null) and fall back to private standalone engines. To enable
 * the persistent mini-player experience, wrap the app once — see the wiring
 * note in MiniPlayer.tsx.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useAudioEngine } from './use-audio-engine';
import type { AudioEngine } from './types';

const AudioContext = createContext<AudioEngine | null>(null);

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const engine = useAudioEngine();

  return (
    <AudioContext.Provider value={engine}>
      {children}
      {/* The single persistent element. Hidden; UI lives in MiniPlayer/AudioPlayer. */}
      <audio ref={engine.audioRef} preload="metadata" className="hidden" aria-hidden="true" />
    </AudioContext.Provider>
  );
}

/**
 * The shared engine, or null when no AudioPlayerProvider is mounted.
 * Callers MUST handle null (standalone fallback) — the provider is opt-in.
 */
export function useAudio(): AudioEngine | null {
  return useContext(AudioContext);
}
