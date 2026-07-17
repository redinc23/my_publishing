'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ChevronDown, Globe } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const footerLinkVariants = { rest: { x: 0 }, hover: { x: 4 } };

const footerColumns = [
  {
    heading: 'Discover',
    links: [
      { label: 'Browse Books', href: '/books' },
      { label: 'Genres', href: '/genres' },
      { label: 'New Releases', href: '/books?sort=published_at' },
      { label: 'Trending', href: '/discover' },
      { label: 'Authors', href: '/authors' },
      { label: 'Audiobooks', href: '/audio' },
    ],
  },
  {
    heading: 'For Authors',
    links: [
      { label: 'Submit Manuscript', href: '/author/submit' },
      { label: 'Author Dashboard', href: '/author/dashboard' },
      { label: 'Royalty Reports', href: '/author/analytics' },
      { label: 'Help Center', href: '/help' },
      { label: 'Community', href: '/readers-hub' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/blog' },
      { label: 'Press Kit', href: '/press' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'FAQs', href: '/faqs' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Cookie Settings', href: '/cookies' },
    ],
  },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={footerLinkVariants}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Link
        href={href}
        className="inline-block text-sm text-muted-foreground transition-colors duration-200 hover:text-primary"
      >
        {children}
      </Link>
    </motion.div>
  );
}

function AppStoreButton({ store, href }: { store: 'App Store' | 'Google Play'; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-secondary"
    >
      <Globe
        className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase leading-none tracking-wide text-muted-foreground">
          {store === 'App Store' ? 'Download on the' : 'Get it on'}
        </span>
        <span className="text-sm font-semibold leading-tight text-foreground">{store}</span>
      </div>
    </a>
  );
}

function PaymentIcon({ name }: { name: string }) {
  return (
    <div
      className="flex h-8 items-center justify-center rounded-md border border-border bg-secondary/60 px-3 text-xs font-medium text-muted-foreground"
      role="img"
      aria-label={`${name} accepted`}
    >
      {name === 'Stripe' && (
        <span className="tracking-wide">
          <span className="text-[#635BFF]">Stripe</span>
        </span>
      )}
      {name === 'Visa' && (
        <span className="font-bold italic tracking-wider text-foreground">VISA</span>
      )}
      {name === 'Mastercard' && (
        <div className="flex items-center gap-0.5">
          <span className="h-3 w-3 rounded-full bg-red-500/90" aria-hidden="true" />
          <span className="-ml-1.5 h-3 w-3 rounded-full bg-yellow-500/90" aria-hidden="true" />
        </div>
      )}
      {name === 'PayPal' && (
        <span className="font-bold tracking-wide">
          <span className="text-[#003087]">Pay</span>
          <span className="text-[#009CDE]">Pal</span>
        </span>
      )}
    </div>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="border-t border-border bg-background">
      <Container>
        <div className="grid grid-cols-1 gap-10 py-16 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-6 lg:col-span-4">
            <Link href="/" className="inline-block">
              <h2 className="text-3xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-primary via-red-400 to-orange-400 bg-clip-text text-transparent">
                  MANGU
                </span>
              </h2>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Your digital publishing platform for discovering and reading great books.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <AppStoreButton store="App Store" href="https://www.apple.com/app-store/" />
              <AppStoreButton store="Google Play" href="https://play.google.com/store" />
            </div>
          </div>

          {footerColumns.map((col) => (
            <div key={col.heading} className="lg:col-span-2">
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-foreground">
                {col.heading}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <div className="border-y border-border bg-muted/30">
        <Container>
          <div className="flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="text-base font-semibold text-foreground">
                  Subscribe to our newsletter
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Get the latest books and updates delivered to your inbox.
              </p>
            </div>
            {subscribed ? (
              <p className="text-sm font-medium text-primary" role="status">
                Thanks for subscribing! Keep an eye on your inbox.
              </p>
            ) : (
              <form
                className="flex w-full items-center gap-3 md:w-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubscribed(true);
                }}
              >
                <Input
                  type="email"
                  required
                  placeholder="Enter your email"
                  className="w-full border-border bg-background md:w-72"
                  aria-label="Email address for newsletter"
                />
                <Button type="submit" className="shrink-0">
                  Subscribe
                </Button>
              </form>
            )}
          </div>
        </Container>
      </div>

      <div className="bg-muted/20">
        <Container>
          <div className="flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
            <p className="text-center text-xs text-muted-foreground md:text-left">
              &copy; {currentYear} MANGU Publishers. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <PaymentIcon name="Visa" />
              <PaymentIcon name="Mastercard" />
              <PaymentIcon name="Stripe" />
              <PaymentIcon name="PayPal" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">
                Made with{' '}
                <span className="text-primary" aria-label="love">
                  &#9829;
                </span>{' '}
                for book lovers
              </span>
              <button
                type="button"
                aria-label="Select language"
                className="hidden items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 sm:flex"
              >
                <Globe className="h-3 w-3" aria-hidden="true" />
                <span>EN</span>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
