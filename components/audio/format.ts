/** Time formatting helpers for audio UI. */

/** 754 → "12:34"; 7542 → "2:05:42". Negative/NaN → "0:00". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = hrs > 0 ? String(mins).padStart(2, '0') : String(mins);
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Long-form duration for catalog cards: "7h 23m" / "42m" / "38s". */
export function formatDurationLong(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const hrs = Math.floor(total / 3600);
  const mins = Math.round((total % 3600) / 60);
  if (hrs > 0) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  return `${mins}m`;
}
