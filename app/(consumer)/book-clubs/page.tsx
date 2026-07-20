import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs',
  description:
    'MANGU book clubs are not available yet. Use the catalog and Readers Hub for group-read planning.',
};

const workingLinks = [
  {
    title: 'Browse the catalog',
    description: 'Pick titles that already exist on MANGU for your next group read.',
    href: '/books',
    cta: 'Browse books',
  },
  {
    title: 'Explore genres',
    description: 'Find themes and categories that spark discussion.',
    href: '/genres',
    cta: 'View genres',
  },
  {
    title: 'Readers Hub',
    description: 'Manage wishlist, highlights, and reading activity that work today.',
    href: '/readers-hub',
    cta: 'Open Readers Hub',
  },
];

export default function BookClubsPage() {
  return (
    <Section>
      <Container>
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary">
          Status: not available yet
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-8 max-w-2xl text-secondary">
          Hosted book clubs are not live on MANGU. There is nothing to join here yet — no fake club
          list, waitlist, or signup form. When clubs ship, this page will say so clearly.
        </p>
        <p className="mb-4 text-sm font-medium text-foreground">Working today</p>
        <ul className="grid gap-6 md:grid-cols-3">
          {workingLinks.map((item) => (
            <li key={item.href} className="border-t border-border pt-4">
              <h2 className="mb-2 text-lg font-semibold">{item.title}</h2>
              <p className="mb-4 text-sm text-secondary">{item.description}</p>
              <Button asChild variant="outline">
                <Link href={item.href}>{item.cta}</Link>
              </Button>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
