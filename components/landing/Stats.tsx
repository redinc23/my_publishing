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

export function Stats() {
  return (
    <section className="py-16 bg-muted/40 border-y border-border">
      <Container>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center text-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
