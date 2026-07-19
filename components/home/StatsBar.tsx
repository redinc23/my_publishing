'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { BookOpen, Users } from 'lucide-react';

export interface Stat {
  value: number;
  suffix: string;
  label: string;
}

const ICONS: Record<string, React.ReactNode> = {
  Books: <BookOpen className="h-5 w-5" />,
  Authors: <Users className="h-5 w-5" />,
};

function AnimatedCounter({
  value,
  suffix,
  inView,
}: {
  value: number;
  suffix: string;
  inView: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let startTime: number;
    let animationFrameId: number;
    const duration = 2000;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [inView, value]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(0);
    if (num >= 1_000) return (num / 1_000).toFixed(num >= 10_000 ? 0 : 1);
    return num.toString();
  };

  const displayValue = value >= 1_000_000 ? formatNumber(count) : count.toLocaleString();

  return (
    <span>
      {displayValue}
      {suffix}
    </span>
  );
}

export function StatsBar({ stats }: { stats: Stat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  // Nothing verifiable to show — render nothing (P0-014, G6).
  if (!stats || stats.length === 0) return null;

  // Fixed class names so Tailwind keeps them; adapts columns to real count.
  const colsClass =
    stats.length >= 4
      ? 'grid-cols-2 md:grid-cols-4'
      : stats.length === 3
        ? 'grid-cols-3'
        : stats.length === 2
          ? 'grid-cols-2'
          : 'grid-cols-1';

  return (
    <section ref={ref} className="border-y border-border/60 bg-muted/20 py-14">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`grid ${colsClass} gap-8 md:gap-4`}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-2 flex items-center gap-2 text-primary">{ICONS[stat.label]}</div>
              <div className="mb-1 text-3xl font-light tracking-tight sm:text-4xl">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} inView={inView} />
              </div>
              <p className="text-sm uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
