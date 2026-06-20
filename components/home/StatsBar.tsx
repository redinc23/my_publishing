'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Container } from '@/components/layout/Container';
import { BookOpen, Users, Globe, FileText } from 'lucide-react';

interface Stat {
  value: number;
  suffix: string;
  label: string;
  icon: ReactNode;
}

const stats: Stat[] = [
  { value: 10000, suffix: '+', label: 'Books', icon: <BookOpen className="h-5 w-5" /> },
  { value: 500, suffix: '+', label: 'Authors', icon: <Users className="h-5 w-5" /> },
  { value: 50000, suffix: '+', label: 'Readers', icon: <Globe className="h-5 w-5" /> },
  { value: 1, suffix: 'M+', label: 'Pages Read', icon: <FileText className="h-5 w-5" /> },
];

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
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!inView) return;

    if (shouldReduceMotion) {
      setCount(value);
      return;
    }

    let startTime: number | undefined;
    let frameId: number;
    const duration = 2000;

    const animate = (timestamp: number) => {
      startTime ??= timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [inView, shouldReduceMotion, value]);

  const displayValue = count.toLocaleString();

  return (
    <span>
      {displayValue}
      {suffix}
    </span>
  );
}

export function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const shouldReduceMotion = useReducedMotion();

  return (
    <section ref={ref} className="border-y border-border/60 bg-muted/20 py-14">
      <Container>
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: 'easeOut' }}
          className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.6,
                delay: shouldReduceMotion ? 0 : index * 0.1,
                ease: 'easeOut',
              }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-2 flex items-center gap-2 text-primary">{stat.icon}</div>
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
