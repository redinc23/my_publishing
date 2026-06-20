'use client';

import { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function NewsletterCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setStatus('loading');
    // TODO: replace with real API call, e.g. POST /api/newsletter
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setStatus('success');
    setEmail('');
    setTimeout(() => setStatus('idle'), 4000);
  };

  return (
    <section
      className="relative overflow-hidden py-20"
      style={{
        background: 'linear-gradient(135deg, #1a1005 0%, #2a1a0a 30%, #3d2410 60%, #1a1005 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 50%, rgba(255,165,0,0.06) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(255,140,0,0.04) 0%, transparent 50%)',
        }}
      />

      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>

          <h2
            className="mb-4 text-3xl font-light tracking-tight sm:text-4xl"
            style={{
              background: 'linear-gradient(45deg, #ffd700, #ff8c00, #ff6b6b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Stay in the Story
          </h2>

          <p className="mb-8 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Get personalized book recommendations and exclusive author updates delivered to your
            inbox.
          </p>

          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-center gap-3 py-4"
              >
                <CheckCircle className="h-6 w-6 text-green-400" />
                <span className="text-lg font-medium text-green-400">
                  You&apos;re subscribed! Welcome aboard.
                </span>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 flex-1 border-border/60 bg-background/80 placeholder:text-muted-foreground/70"
                  required
                />
                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  className="h-12 rounded-md px-8 font-semibold"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="mt-4 text-xs text-muted-foreground/60">
            No spam, ever. Unsubscribe anytime.
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
