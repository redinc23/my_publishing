'use client';

import { useEffect, useState } from 'react';
import type { BookWithAuthor } from '@/types';
import {
  RecommendationsRailSkeleton,
  RecommendationsRailView,
  type RailBookItem,
} from './RecommendationsRail';

/**
 * "Because you read …" rail: resolves the signed-in reader's anchor book via
 * the Resonance Engine, then loads vector-similar titles. Renders NOTHING for
 * anonymous visitors or readers without history (cold start suppression).
 */

interface AnchorPayload {
  id: string;
  title: string;
}

interface SimilarApiItem {
  book: BookWithAuthor;
  reason?: string;
}

export interface BecauseYouReadRailProps {
  railId: string;
  className?: string;
  limit?: number;
}

export function BecauseYouReadRail({ railId, className, limit = 12 }: BecauseYouReadRailProps) {
  const [anchor, setAnchor] = useState<AnchorPayload | null>(null);
  const [items, setItems] = useState<RailBookItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Step 1 — find the reader's anchor book (most recent engagement).
  useEffect(() => {
    const controller = new AbortController();
    setAnchor(null);
    setItems(null);
    setFailed(false);

    fetch('/api/resonance/recommend?mode=personal&limit=1', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        const anchorData = (json as { data?: { anchor?: AnchorPayload | null } } | null)?.data
          ?.anchor;
        if (!anchorData || typeof anchorData.id !== 'string') {
          // Anonymous or no history → suppress the rail entirely.
          setFailed(true);
          return;
        }
        setAnchor(anchorData);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, []);

  // Step 2 — load "readers also enjoyed" for the anchor book.
  useEffect(() => {
    if (!anchor) return;
    const controller = new AbortController();

    fetch(`/api/resonance/similar?bookId=${encodeURIComponent(anchor.id)}&limit=${limit}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        const rawItems = (json as { items?: SimilarApiItem[] } | null)?.items;
        if (!Array.isArray(rawItems)) {
          setFailed(true);
          return;
        }
        setItems(
          rawItems
            .filter((item) => item && item.book && typeof item.book.id === 'string')
            .map((item) => ({ book: item.book, reason: item.reason }))
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [anchor, limit]);

  if (failed) return null;
  if (!anchor) return null; // still resolving anchor; stay invisible
  if (items === null) return <RecommendationsRailSkeleton className={className} />;
  if (items.length === 0) return null;

  return (
    <RecommendationsRailView
      title={`Because you read ${anchor.title}`}
      subtitle="Picked by the Resonance Engine"
      items={items}
      railId={railId}
      className={className}
      showReasons={false}
    />
  );
}
