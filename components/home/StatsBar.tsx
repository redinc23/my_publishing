'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useInView } from 'framer-motion';
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

  useEffect(() => {
    if (!inView) return;
    let startTime: number;
    const duration = 2000;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
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

export function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-14 bg-muted/20 border-y border-border/60">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              <div className="flex items-center gap-2 text-primary mb-2">{stat.icon}</div>
              <div className="text-3xl sm:text-4xl font-light tracking-tight mb-1">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} inView={inView} />
              </div>
              <p className="text-sm text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
