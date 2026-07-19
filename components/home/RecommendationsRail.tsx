'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import type { BookWithAuthor } from '@/types';

export interface RailBookItem {
  book: BookWithAuthor;
  reason?: string;
}

interface TrackedWindow {
  ids: string[];
  visibleSince: number;
  scrolled: boolean;
}

/** Impressions only count after this much on-screen dwell (ms). */
const IMPRESSION_DWELL_MS = 800;
/** Capped payload sent to /api/resonance/track per flush. */
const MAX_IMPRESSIONS_PER_FLUSH = 20;

/**
 * Batched impression/click analytics for recommendation rails.
 * Events buffer in memory and flush on an interval + pagehide (keepalive).
 */
function useRailAnalytics(railId: string | undefined) {
  const bufferRef = useRef<Array<Record<string, unknown>>>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const windowRef = useRef<TrackedWindow | null>(null);

  const flush = useCallback(
    (keepalive = false) => {
      if (!railId || bufferRef.current.length === 0) return;
      const events = bufferRef.current.splice(0, MAX_IMPRESSIONS_PER_FLUSH);
      try {
        void fetch('/api/resonance/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(events),
          keepalive,
        }).catch(() => {
          // Analytics must never break the UI.
        });
      } catch {
        // Ignore.
      }
    },
    [railId]
  );

  useEffect(() => {
    if (!railId) return;
    const interval = window.setInterval(() => flush(false), 5000);
    const onHide = () => flush(true);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush(true);
    };
  }, [railId, flush]);

  const trackImpressions = useCallback(
    (ids: string[], viaScroll: boolean) => {
      if (!railId || ids.length === 0) return;
      const now = Date.now();
      const pending = windowRef.current;
      if (
        !pending ||
        pending.ids.join(',') !== ids.join(',') ||
        (viaScroll && !pending.scrolled)
      ) {
        windowRef.current = { ids, visibleSince: now, scrolled: viaScroll };
        return; // dwell first; the next interval tick fires the impression
      }
      if (now - pending.visibleSince < IMPRESSION_DWELL_MS) return;

      const fresh = ids.filter((id) => !seenRef.current.has(`resonance:imp:${railId}:${id}`));
      if (fresh.length === 0) return;
      for (const id of fresh) {
        seenRef.current.add(`resonance:imp:${railId}:${id}`);
        bufferRef.current.push({
          book_id: id,
          event_type: 'impression',
          event_value: { rail: railId, via_scroll: viaScroll },
        });
      }
    },
    [railId]
  );

  const trackClick = useCallback(
    (bookId: string) => {
      if (!railId) return;
      bufferRef.current.push({
        book_id: bookId,
        event_type: 'click',
        event_value: { rail: railId },
      });
      flush(false);
    },
    [railId, flush]
  );

  return { trackImpressions, trackClick };
}

// ── Presentation ─────────────────────────────────────────────────────────────

function RailBookCard({
  item,
  showReason,
  onClick,
}: {
  item: RailBookItem;
  showReason: boolean;
  onClick?: () => void;
}) {
  const { book } = item;
  const href = `/books/${book.slug ?? book.id}`;
  const author = book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';
  const rating =
    typeof book.average_rating === 'number' && book.average_rating > 0
      ? book.average_rating
      : null;

  return (
    <li className="w-[150px] flex-shrink-0 snap-start sm:w-[170px]">
      <Link
        href={href}
        onClick={onClick}
        className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              fill
              sizes="(max-width: 640px) 150px, 170px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No cover
            </div>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{book.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{author}</p>
        {rating !== null && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)}
          </p>
        )}
        {showReason && item.reason && (
          <p className="mt-1 line-clamp-1 text-[11px] italic text-muted-foreground/80">
            {item.reason}
          </p>
        )}
      </Link>
    </li>
  );
}

export interface RecommendationsRailViewProps {
  title: string;
  subtitle?: string;
  items: RailBookItem[];
  railId?: string;
  className?: string;
  showReasons?: boolean;
}

/** Shared horizontal rail UI (also used by BecauseYouReadRail). */
export function RecommendationsRailView({
  title,
  subtitle,
  items,
  railId,
  className,
  showReasons = true,
}: RecommendationsRailViewProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const { trackImpressions, trackClick } = useRailAnalytics(railId);

  // Impression tracking: fire for the visible window on mount and after scrolls.
  useEffect(() => {
    if (!railId || items.length === 0) return;
    const list = listRef.current;
    if (!list) return;

    const visibleIds = () =>
      Array.from(list.querySelectorAll('li'))
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.right > 0 && rect.left < window.innerWidth;
        })
        .map((el, index) => items[index]?.book.id)
        .filter((id): id is string => typeof id === 'string');

    const initial = window.setTimeout(() => trackImpressions(visibleIds(), false), 600);
    let scrollTimer: number | null = null;
    const onScroll = () => {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => trackImpressions(visibleIds(), true), 400);
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(initial);
      if (scrollTimer) window.clearTimeout(scrollTimer);
      list.removeEventListener('scroll', onScroll);
    };
  }, [railId, items, trackImpressions]);

  const scrollBy = (dir: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    list.scrollBy({ left: dir * Math.round(list.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <Section className={className}>
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-light tracking-tight sm:text-3xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-secondary">{subtitle}</p>}
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scrollBy(-1)}
              aria-label="Scroll recommendations left"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => scrollBy(1)}
              aria-label="Scroll recommendations right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ul
          ref={listRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <RailBookCard
              key={item.book.id}
              item={item}
              showReason={showReasons}
              onClick={() => trackClick(item.book.id)}
            />
          ))}
        </ul>
      </Container>
    </Section>
  );
}

export function RecommendationsRailSkeleton({ className }: { className?: string }) {
  return (
    <Section className={className}>
      <Container>
        <div className="mb-6 h-8 w-56 animate-pulse rounded bg-muted" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="w-[150px] flex-shrink-0 sm:w-[170px]">
              <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── Data-driven rail (default export pattern used on the homepage) ──────────

export interface RecommendationsRailProps {
  title: string;
  subtitle?: string;
  /** Absolute path to a resonance API returning { items: [{ book, reason? }] }. */
  endpoint: string;
  railId?: string;
  className?: string;
}

interface ApiRailItem {
  book: BookWithAuthor;
  reason?: string;
}

/**
 * Client-side rail that fetches a resonance endpoint and renders books.
 * Self-suppressing: renders nothing (not even a heading) when the API errors,
 * returns an unexpected payload, or yields zero books.
 */
export function RecommendationsRail({
  title,
  subtitle,
  endpoint,
  railId,
  className,
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
        const rawItems = (json as { data?: { items?: ApiRailItem[] } } | null)?.data?.items;
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
    />
  );
}
