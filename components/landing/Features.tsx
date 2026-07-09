// PERF-PHASE2-5 — Converted to RSC: no hooks, no interactivity, static markup only
import { BookOpen, Users, Zap, Shield, Globe, Heart } from 'lucide-react';
import { Container } from '@/components/layout/Container';

const features = [
  {
    icon: BookOpen,
    title: 'Digital Publishing',
    description: 'Publish your books in multiple formats including EPUB, PDF, and more.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Connect with readers and authors in our vibrant community.',
  },
  {
    icon: Zap,
    title: 'AI Recommendations',
    description:
      'Discover books tailored to your reading preferences with AI-powered recommendations.',
  },
  {
    icon: Shield,
    title: 'Secure Platform',
    description: 'Your content is protected with enterprise-grade security.',
  },
  {
    icon: Globe,
    title: 'Global Reach',
    description: 'Reach readers worldwide with our international platform.',
  },
  {
    icon: Heart,
    title: 'Reader-Focused',
    description: 'Built with readers in mind, offering the best reading experience.',
  },
];

export function Features() {
  return (
    <section className="bg-background py-24">
      <Container>
        <div className="mb-16 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            What We Offer
          </p>
          <h2 className="mb-4 text-4xl font-bold">Why Choose MANGU?</h2>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Everything you need to publish, discover, and enjoy books in one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
