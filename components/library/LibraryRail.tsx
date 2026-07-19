'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { LibraryCard } from './LibraryCard';
import type { LibraryItem } from './types';

interface LibraryRailProps {
  title: string;
  items: LibraryItem[];
}

const CHEVRON_CLASSES =
  'absolute top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white opacity-0 transition hover:bg-black/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5484d] group-hover/rail:opacity-100 md:flex';

export function LibraryRail({ title, items }: LibraryRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  if (items.length === 0) return null;

  const scrollByDirection = (direction: 'left' | 'right') => {
    const rail = railRef.current;
    if (!rail) return;
    const amount = rail.clientWidth * 0.8 * (direction === 'left' ? -1 : 1);
    rail.scrollBy({ left: amount, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  };

  return (
    <section aria-label={title} className="group/rail">
      <Container>
        <div className="mb-3 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold text-[#f5f1ea] md:text-2xl">{title}</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-sm text-stone-400">
            {items.length}
          </span>
        </div>
        <div className="relative">
          <div
            ref={railRef}
            className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto py-4"
          >
            {items.map((item) => (
              <div
                key={`${item.orderNumber}-${item.book.id}`}
                className="w-[40vw] max-w-[220px] shrink-0 snap-start md:w-[220px]"
              >
                <LibraryCard item={item} />
              </div>
            ))}
          </div>

          {/* Edge fades — purely decorative. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#12100e] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#12100e] to-transparent"
          />

          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByDirection('left')}
            className={`${CHEVRON_CLASSES} left-1`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByDirection('right')}
            className={`${CHEVRON_CLASSES} right-1`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </Container>
    </section>
  );
}
