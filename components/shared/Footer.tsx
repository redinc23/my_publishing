'use client';

import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Twitter, Github, Instagram, Linkedin, Mail, ChevronDown, Globe } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const footerLinkVariants = { rest: { x: 0 }, hover: { x: 4 } };

const socialLinks = [
  { name: 'Twitter', icon: Twitter, href: '#' },
  { name: 'GitHub', icon: Github, href: '#' },
  { name: 'Instagram', icon: Instagram, href: '#' },
  { name: 'LinkedIn', icon: Linkedin, href: '#' },
];

const footerColumns = [
  {
    heading: 'Discover',
    links: [
      { label: 'Browse Books', href: '/books' },
      { label: 'Genres', href: '/genres' },
      { label: 'New Releases', href: '/new-releases' },
      { label: 'Trending', href: '/trending' },
      { label: 'Authors', href: '/authors' },
      { label: 'Audiobooks', href: '/audiobooks' },
    ],
  },
  {
    heading: 'For Authors',
    links: [
      { label: 'Submit Manuscript', href: '/author/submit' },
      { label: 'Author Dashboard', href: '/author/dashboard' },
      { label: 'Royalty Reports', href: '/author/royalties' },
      { label: 'Marketing Guide', href: '/author/marketing' },
      { label: 'Community', href: '/author/community' },
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

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
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

function SocialIcon({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: ElementType;
  label: string;
}) {
  return (
    <motion.a
      href={href}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/50 text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-primary"
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <Icon className="h-4 w-4" />
    </motion.a>
  );
}

function AppStoreButton({ store }: { store: 'App Store' | 'Google Play' }) {
  return (
    <button
      type="button"
      className="group flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-secondary"
    >
      <Globe className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
      <div className="flex flex-col">
        <span className="text-[10px] uppercase leading-none tracking-wide text-muted-foreground">
          {store === 'App Store' ? 'Download on the' : 'Get it on'}
        </span>
        <span className="text-sm font-semibold leading-tight text-foreground">{store}</span>
      </div>
    </button>
  );
}

function PaymentIcon({ name }: { name: string }) {
  return (
    <div className="flex h-8 items-center justify-center rounded-md border border-border bg-secondary/60 px-3 text-xs font-medium text-muted-foreground">
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
          <span className="h-3 w-3 rounded-full bg-red-500/90" />
          <span className="-ml-1.5 h-3 w-3 rounded-full bg-yellow-500/90" />
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
            <div className="flex items-center gap-3 pt-1">
              {socialLinks.map((social) => (
                <SocialIcon
                  key={social.name}
                  href={social.href}
                  icon={social.icon}
                  label={social.name}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <AppStoreButton store="App Store" />
              <AppStoreButton store="Google Play" />
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.heading} className="lg:col-span-2">
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-foreground">
                {column.heading}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
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
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">
                  Subscribe to our newsletter
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Get the latest books and updates delivered to your inbox.
              </p>
            </div>
            <form
              className="flex w-full items-center gap-3 md:w-auto"
              onSubmit={(event) => event.preventDefault()}
            >
              <Input
                type="email"
                placeholder="Enter your email"
                className="w-full border-border bg-background md:w-72"
                aria-label="Email address for newsletter"
              />
              <Button type="submit" className="shrink-0">
                Subscribe
              </Button>
            </form>
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
              <div className="hidden cursor-pointer items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 sm:flex">
                <Globe className="h-3 w-3" />
                <span>EN</span>
                <ChevronDown className="h-3 w-3" />
              </div>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
