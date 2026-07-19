/**
 * Validation schemas for audiobook listening-progress sync.
 *
 * Kept separate from schemas.ts (shared file) to stay additive; reuses the
 * canonical UUIDSchema from the shared module.
 */

import { z } from 'zod';
import { UUIDSchema } from './schemas';

/** Sanity ceiling: 7 days of audio, in seconds. */
const MAX_AUDIO_SECONDS = 60 * 60 * 24 * 7;

export const ListeningProgressPutSchema = z.object({
  book_id: UUIDSchema,
  position_seconds: z
    .number({ invalid_type_error: 'position_seconds must be a number' })
    .int('position_seconds must be an integer')
    .min(0, 'position_seconds must be >= 0')
    .max(MAX_AUDIO_SECONDS, 'position_seconds is out of range'),
  duration_seconds: z
    .number({ invalid_type_error: 'duration_seconds must be a number' })
    .int('duration_seconds must be an integer')
    .min(0, 'duration_seconds must be >= 0')
    .max(MAX_AUDIO_SECONDS, 'duration_seconds is out of range'),
});

export const ListeningProgressGetSchema = z.object({
  book_id: UUIDSchema,
});

export type ListeningProgressPut = z.infer<typeof ListeningProgressPutSchema>;
export type ListeningProgressGet = z.infer<typeof ListeningProgressGetSchema>;
