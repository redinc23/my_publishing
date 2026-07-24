/**
 * Shared types for the MANGU audiobook experience.
 */

export interface AudioChapter {
  id: string;
  title: string;
  /** Start offset in seconds from the beginning of the audio file. */
  start: number;
  /** Optional explicit end in seconds; inferred from next chapter / duration. */
  end?: number;
}

export interface AudioTrackInfo {
  /** Absolute or site-relative URL of the audio file. */
  src: string;
  title?: string;
  author?: string;
  narrator?: string;
  coverUrl?: string;
  /** Book UUID — enables server-side progress sync when present. */
  bookId?: string;
  chapters?: AudioChapter[];
}

/** Persisted progress snapshot (localStorage and server row share this shape). */
export interface SavedAudioProgress {
  position: number;
  duration: number;
  /** Epoch milliseconds of the last update. */
  updatedAt: number;
}

export type SleepTimerState =
  | { mode: 'minutes'; endsAt: number; remainingSec: number }
  | { mode: 'chapter'; remainingSec: null };

export interface AudioEngine {
  /** Attach to the (hidden) <audio> element rendered by the consumer. */
  audioRef: React.RefObject<HTMLAudioElement>;
  track: AudioTrackInfo | null;
  isPlaying: boolean;
  /** True while the element is stalled/buffering during playback. */
  isBuffering: boolean;
  /** True after metadata is loaded (duration known). */
  hasMetadata: boolean;
  currentTime: number;
  duration: number;
  /** 0..1 fraction of the file that has downloaded (best buffered range). */
  bufferedFraction: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  sleepTimer: SleepTimerState | null;
  chapters: AudioChapter[];
  activeChapterIndex: number;
  /**
   * Saved position awaiting a resume decision (Resume / Start over prompt).
   * Null when there is nothing meaningful to resume.
   */
  resumePosition: number | null;
  /** False after the server answered 401/503 — sync skipped for the session. */
  serverSyncEnabled: boolean;

  /** Load a track (optionally autoplaying). No-op if the same src is loaded. */
  loadTrack: (track: AudioTrackInfo, opts?: { autoplay?: boolean }) => void;
  /** Load (if needed) and play the given track. */
  playTrack: (track: AudioTrackInfo) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSleepTimerMinutes: (minutes: number) => void;
  setSleepTimerEndOfChapter: () => void;
  cancelSleepTimer: () => void;
  /** Resume prompt actions. */
  applyResume: (autoplay?: boolean) => void;
  dismissResume: () => void;
  /** Pause, persist, and clear the track entirely (mini-player close). */
  stop: () => void;
}
