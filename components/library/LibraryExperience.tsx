'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { ContinueReadingHero } from './ContinueReadingHero';
import { LibraryRail } from './LibraryRail';
import { EmptyLibrary } from './EmptyLibrary';
import type { LibraryItem } from './types';

interface LibraryExperienceProps {
  /** Every purchased item, latest purchase first (server-sorted). */
  items: LibraryItem[];
}

interface RailDefinition {
  key: string;
  title: string;
  items: LibraryItem[];
}

/**
 * Cinema Library — a Netflix-for-books canvas that renders dark regardless
 * of the site theme toggle. Orchestrates the continue-reading hero and the
 * horizontal rails from the server-built view-model.
 */
export function LibraryExperience({ items }: LibraryExperienceProps) {
  const shouldReduceMotion = useReducedMotion();

  const { continueReading, finished } = useMemo(() => {
    const inProgress = items
      .filter((item) => item.progress && !item.progress.isFinished)
      .sort((a, b) => {
        const aTime = a.progress?.lastAccessed ? Date.parse(a.progress.lastAccessed) : 0;
        const bTime = b.progress?.lastAccessed ? Date.parse(b.progress.lastAccessed) : 0;
        return bTime - aTime;
      });
    const done = items.filter((item) => item.progress?.isFinished);
    return { continueReading: inProgress, finished: done };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f5f1ea]">
        <h1 className="sr-only">Your Library</h1>
        <EmptyLibrary />
      </div>
    );
  }

  const rails: RailDefinition[] = [
    // Netflix-style: the rail shows ALL in-progress items, including the hero book.
    { key: 'continue-reading', title: 'Continue Reading', items: continueReading },
    { key: 'your-library', title: 'Your Library', items },
    { key: 'finished', title: 'Finished', items: finished },
  ].filter((rail) => rail.items.length > 0);

  const heroItem = continueReading[0];

  return (
    <div className="min-h-screen bg-[#12100e] pb-20 text-[#f5f1ea]">
      <h1 className="sr-only">Your Library</h1>
      {heroItem && <ContinueReadingHero item={heroItem} />}
      <div className={cn('space-y-10 md:space-y-14', heroItem ? 'pt-10' : 'pt-16')}>
        {rails.map((rail, index) => (
          <motion.div
            key={rail.key}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: shouldReduceMotion ? 0 : index * 0.08,
              ease: 'easeOut',
            }}
          >
            <LibraryRail title={rail.title} items={rail.items} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
