'use client';

import { BookOpen, Users, Star, Globe } from 'lucide-react';
import { Container } from '@/components/layout/Container';

const stats = [
  {
    icon: BookOpen,
    value: '50,000+',
    label: 'Books Published',
  },
  {
    icon: Users,
    value: '10,000+',
    label: 'Active Authors',
  },
  {
    icon: Star,
    value: '4.8',
    label: 'Average Rating',
  },
  {
    icon: Globe,
    value: '150+',
    label: 'Countries Reached',
  },
];

export function StatsBar() {
  return (
    <section className="py-12 bg-muted/40 border-y border-border">
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
