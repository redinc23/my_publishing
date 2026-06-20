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
      className="relative py-20 overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, #1a1005 0%, #2a1a0a 30%, #3d2410 60%, #1a1005 100%)',
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
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
          className="max-w-2xl mx-auto text-center"
        >
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-6">
            <Mail className="h-6 w-6 text-primary" />
          </div>

          {/* Headline */}
          <h2
            className="text-3xl sm:text-4xl font-light tracking-tight mb-4"
            style={{
              background: 'linear-gradient(45deg, #ffd700, #ff8c00, #ff6b6b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Stay in the Story
          </h2>

          {/* Subtext */}
          <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed">
            Get personalized book recommendations and exclusive author updates delivered to your inbox.
          </p>

          {/* Form */}
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
                className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 h-12 bg-background/80 border-border/60 placeholder:text-muted-foreground/70"
                  required
                />
                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  className="h-12 px-8 font-semibold rounded-md"
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

          <p className="text-xs text-muted-foreground/60 mt-4">
            No spam, ever. Unsubscribe anytime.
          </p>
        </motion.div>
      </Container>
    </section>
  );
}
