'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, PenTool } from 'lucide-react';
import { Container } from '@/components/layout/Container';

export function CTA() {
  return (
    <section
      className="py-24 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 40%, #0f3460 100%)',
      }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 70% 50%, rgba(255,215,0,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 50%, rgba(138,43,226,0.06) 0%, transparent 50%)',
        }}
      />

      <Container className="relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-medium tracking-widest uppercase text-white/50 mb-4">
            Get Started Today
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">
            Ready to Begin Your{' '}
            <span
              style={{
                background: 'linear-gradient(45deg, #ffd700, #ff8c00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Story?
            </span>
          </h2>
          <p className="text-lg text-white/70 mb-10 leading-relaxed">
            Join thousands of authors and readers on the MANGU platform.
            Start publishing your books today or discover your next great read.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 py-6 text-base font-semibold shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <Link href="/register">
                <BookOpen className="mr-2 h-5 w-5" />
                Start Reading
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full px-8 py-6 text-base font-semibold border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all duration-300 hover:-translate-y-1"
            >
              <Link href="/author/submit">
                <PenTool className="mr-2 h-5 w-5" />
                Become an Author
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
