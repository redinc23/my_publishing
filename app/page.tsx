import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';
import { ArrowRight } from 'lucide-react';
import { Stats } from '@/components/landing/Stats';
import { Features } from '@/components/landing/Features';
import { CTA } from '@/components/landing/CTA';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Background depth layer — giant faded "MANGU" text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <span className="text-[22vw] font-black text-foreground/[0.03] dark:text-foreground/[0.05] select-none tracking-tighter leading-none">
          MANGU
        </span>
      </div>

      {/* Secondary depth layer — "PUBLISHERS" at bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none overflow-hidden pb-[10vh]">
        <span className="text-[18vw] font-black text-foreground/[0.02] dark:text-foreground/[0.04] select-none tracking-tighter leading-none">
          PUBLISHERS
        </span>
      </div>

      {/* Hero Section */}
      <section
        className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)',
        }}
      >
        {/* Radial glow effects */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 20% 80%, rgba(255,215,0,0.08) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(138,43,226,0.08) 0%, transparent 40%), radial-gradient(circle at 40% 40%, rgba(0,115,230,0.06) 0%, transparent 40%)',
          }}
        />

        {/* Content */}
        <Container className="relative z-10 py-20">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Overline */}
            <p className="text-sm font-medium tracking-[0.3em] uppercase text-muted-foreground mb-6 animate-fade-in">
              Welcome to
            </p>

            {/* Main Title */}
            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-[0.15em] uppercase leading-[0.9] mb-8"
              style={{
                background: 'linear-gradient(45deg, #ffd700, #ff8c00, #ff6b6b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              MANGU
              <br />
              <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-[0.2em]">
                PUBLISHING
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-white/85 font-light leading-relaxed mb-10 max-w-2xl animate-slide-up">
              Discover a universe of stories. Stream unlimited books, audiobooks,
              and exclusive videos anywhere, anytime.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-base font-semibold shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <Link href="/books">
                  Explore Library
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-8 py-6 text-base font-semibold border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all duration-300 hover:-translate-y-1"
              >
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Stats Section */}
      <Stats />

      {/* Features Section */}
      <Features />

      {/* CTA Section */}
      <CTA />
    </div>
  );
}
