'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { BookWithAuthor } from '@/types';

/**
 * Resonance Engine — Netflix-style horizontal recommendation rail.
 *
 * Contract:
 *  - Self-fetching rails render a skeleton while loading and NOTHING when the
 *    endpoint errors or returns no items (empty-state suppression).
 *  - Impressions (batched, once per session per rail) and clicks are tracked
 *    via /api/resonance/track. Tracking is fire-and-forget and can never
 *    break rendering.
 */

export interface RailBookItem {
  book: BookWithAuthor;
  reason?: string;
}

const TRACK_URL = '/api/resonance/track';

interface TrackEvent {
  book_id: string;
  event_type: 'impression' | 'click';
  event_value: Record<string, unknown>;
}

function sendTrackEvents(events: TrackEvent[], keepalive = false): void {
  if (events.length === 0 || typeof window === 'undefined') return;
  try {
    const payload = events.length === 1 ? events[0] : events;
    void fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive,
    }).catch(() => {
      /* analytics must never surface */
    });
  } catch {
    /* noop */
  }
}

function impressionSentThisSession(railId: string): boolean {
  try {
    return window.sessionStorage.getItem(`resonance:imp:${railId}`) === '1';
  } catch {
    return false;
  }
}

function markImpressionSent(railId: string): void {
  try {
    window.sessionStorage.setItem(`resonance:imp:${railId}`, '1');
  } catch {
    /* private mode etc. */
  }
}

/** Fires one batched impression event set when the rail scrolls into view. */
function useImpressionTracking(
  containerRef: RefObject<HTMLElement | null>,
  railId: string,
  items: RailBookItem[]
): void {
  useEffect(() => {
    const node = containerRef.current;
    if (!node || items.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;
    if (impressionSentThisSession(railId)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) return;
        observer.disconnect();
        markImpressionSent(railId);
        sendTrackEvents(
          items.map((item, index) => ({
            book_id: item.book.id,
            event_type: 'impression',
            event_value: { rail: railId, position: index, reason: item.reason ?? null },
          }))
        );
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef, railId, items]);
}

function trackClick(railId: string, item: RailBookItem, position: number): void {
  sendTrackEvents(
    [
      {
        book_id: item.book.id,
        event_type: 'click',
        event_value: { rail: railId, position, reason: item.reason ?? null },
      },
    ],
    true
  );
}

export interface RecommendationsRailViewProps {
  title: string;
  subtitle?: string;
  items: RailBookItem[];
  railId: string;
  className?: string;
  showReasons?: boolean;
}

/** Presentational rail: header + horizontal snap row + tracking. */
export function RecommendationsRailView({
  title,
  subtitle,
  items,
  railId,
  className,
  showReasons = true,
}: RecommendationsRailViewProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  useImpressionTracking(sectionRef, railId, items);

  if (items.length === 0) return null;

  const scrollByAmount = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section ref={sectionRef} aria-label={title} className={cn('py-10', className)}>
      <Container>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-light tracking-tight sm:text-2xl">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              aria-label={`Scroll ${title} left`}
              onClick={() => scrollByAmount(-1)}
              className="rounded-full border border-border/60 bg-background/60 p-2 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Scroll ${title} right`}
              onClick={() => scrollByAmount(1)}
              className="rounded-full border border-border/60 bg-background/60 p-2 text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ul
          ref={scrollerRef}
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        >
          {items.map((item, index) => (
            <li
              key={item.book.id}
              className="w-[150px] shrink-0 snap-start sm:w-[170px] lg:w-[190px]"
            >
              <div onClickCapture={() => trackClick(railId, item, index)}>
                <BookCard book={item.book} variant="compact" />
              </div>
              {showReasons && item.reason && (
                <p className="mt-1.5 line-clamp-1 text-xs text-primary/80">{item.reason}</p>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export function RecommendationsRailSkeleton({ className }: { className?: string }) {
  return (
    <section aria-hidden="true" className={cn('py-10', className)}>
      <Container>
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-7 w-44" />
        </div>
        <div className="scrollbar-hide flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="w-[150px] shrink-0 sm:w-[170px] lg:w-[190px]">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-1 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

interface RecommendApiItem {
  book: BookWithAuthor;
  reason?: string;
}

/** Extract rail items from a Resonance Engine API payload. */
export function mapRecommendResponse(json: unknown): RailBookItem[] {
  try {
    const data = (json as { data?: { items?: RecommendApiItem[] } } | null)?.data;
    if (!data?.items || !Array.isArray(data.items)) return [];
    return data.items
      .filter((item) => item && item.book && typeof item.book.id === 'string')
      .map((item) => ({ book: item.book, reason: item.reason }));
  } catch {
    return [];
  }
}

export interface RecommendationsRailProps {
  title: string;
  subtitle?: string;
  /** Absolute path + query of a Resonance recommend-shaped endpoint. */
  endpoint: string;
  railId: string;
  className?: string;
  showReasons?: boolean;
}

/**
 * Self-fetching rail bound to /api/resonance/recommend. Renders nothing when
 * the request fails or yields no items.
 */
export function RecommendationsRail({
  title,
  subtitle,
  endpoint,
  railId,
  className,
  showReasons = true,
}: RecommendationsRailProps) {
  const [items, setItems] = useState<RailBookItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setFailed(false);

    fetch(endpoint, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (controller.signal.aborted) return;
        if (!json) {
          setFailed(true);
          return;
        }
        setItems(mapRecommendResponse(json));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [endpoint]);

  if (failed) return null;
  if (items === null) return <RecommendationsRailSkeleton className={className} />;
  if (items.length === 0) return null;

  return (
    <RecommendationsRailView
      title={title}
      subtitle={subtitle}
      items={items}
      railId={railId}
      className={className}
      showReasons={showReasons}
    />
  );
}
