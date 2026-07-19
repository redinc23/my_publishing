'use client';

import { useEffect, useState } from 'react';
import type { BookWithAuthor } from '@/types';
import { BookCard } from '@/components/cards/BookCard';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export interface RailBookItem {
  book: BookWithAuthor;
  reason?: string;
}

interface RecommendationsRailViewProps {
  title: string;
  subtitle?: string;
  items: RailBookItem[];
  railId: string;
  className?: string;
  showReasons?: boolean;
}

export function RecommendationsRailView({
  title,
  subtitle,
  items,
  railId,
  className,
  showReasons = true,
}: RecommendationsRailViewProps) {
  if (items.length === 0) return null;

  return (
    <Section className={className}>
      <Container>
        <div className="mb-7">
          <h2 id={`${railId}-heading`} className="text-2xl font-light tracking-tight sm:text-3xl">
            {title}
          </h2>
          {subtitle ? <p className="mt-2 text-sm text-secondary">{subtitle}</p> : null}
        </div>
        <div
          id={railId}
          aria-labelledby={`${railId}-heading`}
          className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6"
        >
          {items.map(({ book, reason }) => (
            <div key={book.id} className="min-w-0">
              <BookCard book={book} variant="compact" />
              {showReasons && reason ? (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{reason}</p>
              ) : null}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

export function RecommendationsRailSkeleton({ className }: { className?: string }) {
  return (
    <Section className={className}>
      <Container>
        <div className="mb-7 h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index}>
              <div className="aspect-[2/3] animate-pulse rounded-lg bg-muted" />
              <div className="mt-3 h-4 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

interface RecommendationsRailProps {
  title: string;
  subtitle?: string;
  endpoint: string;
  railId: string;
  className?: string;
}

function normalizeItems(payload: unknown): RailBookItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as {
    items?: RailBookItem[];
    data?: { items?: RailBookItem[]; books?: BookWithAuthor[] } | BookWithAuthor[];
  };

  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.data)) return root.data.map((book) => ({ book }));
  if (root.data && !Array.isArray(root.data)) {
    if (Array.isArray(root.data.items)) return root.data.items;
    if (Array.isArray(root.data.books)) return root.data.books.map((book) => ({ book }));
  }
  return [];
}

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
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (controller.signal.aborted) return;
        const nextItems = normalizeItems(payload).filter(
          (item) => item?.book && typeof item.book.id === 'string'
        );
        setItems(nextItems);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [endpoint]);

  if (failed) return null;
  if (items === null) return <RecommendationsRailSkeleton className={className} />;
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
