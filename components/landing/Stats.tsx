// PERF-PHASE2-5 — Converted to RSC: no hooks, no interactivity, static markup only
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
    label: 'Average Rating (out of 5 ★)',
  },
  {
    icon: Globe,
    value: '150+',
    label: 'Countries Reached',
  },
];

export function Stats() {
  return (
    <section className="border-y border-border bg-muted/40 py-16">
      <Container>
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
