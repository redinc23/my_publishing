/**
 * Canonical manuscript workflow types (PR 1 — schema/RLS/storage hardening).
 *
 * Source of truth for the editorial status vocabulary and review decisions.
 * Matches supabase/migrations/20260724000000–20260724000006.
 */

export const MANUSCRIPT_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'revisions_requested',
  'accepted',
  'rejected',
  'withdrawn',
  'converted_to_book',
] as const;

export type ManuscriptStatus = (typeof MANUSCRIPT_STATUSES)[number];

export const MANUSCRIPT_REVIEW_DECISIONS = [
  'pending',
  'changes_requested',
  'accepted',
  'rejected',
] as const;

export type ManuscriptReviewDecision =
  (typeof MANUSCRIPT_REVIEW_DECISIONS)[number];

/**
 * Legal author-initiated transitions. Everything else requires staff
 * (enforced server-side by protect_manuscript_workflow_fields()).
 */
export const AUTHOR_ALLOWED_TRANSITIONS: ReadonlyArray<
  readonly [ManuscriptStatus, ManuscriptStatus]
> = [
  ['draft', 'submitted'],
  ['revisions_requested', 'submitted'],
  ['submitted', 'withdrawn'],
] as const;

export interface Manuscript {
  id: string;
  authorId: string;
  bookId: string | null;
  assignedReviewerId: string | null;
  convertedByProfileId: string | null;
  title: string;
  workingTitle: string | null;
  genre: string;
  synopsis: string | null;
  wordCount: number | null;
  targetAudience: string | null;
  status: ManuscriptStatus;
  currentStage: string | null;
  editorialNotes: string | null;
  authorNotes: string | null;
  internalNotes: string | null;
  manuscriptFileUrl: string | null;
  sampleChaptersUrl: string | null;
  coverDraftUrl: string | null;
  versionNumber: number;
  submittedAt: string | null;
  assignedAt: string | null;
  reviewStartedAt: string | null;
  decisionAt: string | null;
  withdrawnAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw manuscript_status_history row (staff-facing). */
export interface ManuscriptStatusHistory {
  id: string;
  manuscriptId: string;
  fromStatus: ManuscriptStatus | null;
  toStatus: ManuscriptStatus;
  changedByProfileId: string | null;
  reason: string | null;
  internalReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Raw manuscript_reviews row (staff/reviewer-facing). */
export interface ManuscriptReview {
  id: string;
  manuscriptId: string;
  reviewerProfileId: string;
  decision: ManuscriptReviewDecision;
  authorFeedback: string | null;
  internalNotes: string | null;
  reviewRound: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

/** Row from the author-safe author_manuscript_status_history view. */
export interface AuthorManuscriptHistoryEntry {
  id: string;
  manuscriptId: string;
  fromStatus: ManuscriptStatus | null;
  toStatus: ManuscriptStatus;
  reason: string | null;
  createdAt: string;
}

/** Row from the author-safe author_manuscript_feedback view. */
export interface AuthorManuscriptFeedback {
  manuscriptId: string;
  decision: ManuscriptReviewDecision;
  authorFeedback: string | null;
  reviewRound: number;
  submittedAt: string | null;
}

export function isManuscriptStatus(value: string): value is ManuscriptStatus {
  return (MANUSCRIPT_STATUSES as readonly string[]).includes(value);
}

export function isAuthorAllowedTransition(
  from: ManuscriptStatus,
  to: ManuscriptStatus
): boolean {
  return AUTHOR_ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to);
}
