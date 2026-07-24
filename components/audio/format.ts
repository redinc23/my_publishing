/** Format a media position as m:ss, or h:mm:ss for long recordings. */
export function formatTime(value: number): string {
  const totalSeconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Format a duration for catalog metadata, for example "1 hr 24 min". */
export function formatDurationLong(value: number): string {
  const totalSeconds = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
  if (minutes > 0) return `${minutes} min`;
  return `${totalSeconds} sec`;
}
