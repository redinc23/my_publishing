'use client';

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
    description: 'Discover books tailored to your reading preferences with AI-powered recommendations.',
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
    <section className="py-24 bg-background">
      <Container>
        <div className="text-center mb-16">
          <p className="text-sm font-medium tracking-widest uppercase text-primary mb-3">
            What We Offer
          </p>
          <h2 className="text-4xl font-bold mb-4">Why Choose MANGU?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to publish, discover, and enjoy books in one platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors duration-300">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
