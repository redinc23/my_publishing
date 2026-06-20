'use client';

import { useState } from 'react';
import { Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Container } from '@/components/layout/Container';

export function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Simulate subscription — wire up to a real endpoint when ready
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <section
      className="py-20 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 40%, #0f3460 100%)',
      }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 30% 50%, rgba(255,215,0,0.06) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(138,43,226,0.06) 0%, transparent 50%)',
        }}
      />

      <Container className="relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-6">
            <Mail className="h-6 w-6 text-white/80" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Stay in the{' '}
            <span
              style={{
                background: 'linear-gradient(45deg, #ffd700, #ff8c00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Story
            </span>
          </h2>

          <p className="text-white/70 mb-8 leading-relaxed">
            Get curated reading picks, author spotlights, and platform news
            delivered straight to your inbox. No spam, ever.
          </p>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <CheckCircle className="h-10 w-10 text-green-400" />
              <p className="font-medium">You&apos;re subscribed! Welcome aboard.</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              />
              <Button
                type="submit"
                disabled={loading}
                className="rounded-full font-semibold whitespace-nowrap"
              >
                {loading ? 'Subscribing…' : 'Subscribe'}
              </Button>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
