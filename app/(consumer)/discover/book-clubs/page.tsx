import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs (not available yet)',
  description:
    'Hosted book clubs are not available on MANGU yet. Browse the catalog and reader tools meanwhile.',
};

/**
 * Discover alias for /book-clubs — same honest status (E-001 / G6).
 * Does not advertise join/create CTAs that do not exist.
 */
export default function DiscoverBookClubsPage() {
  return (
    <Section>
      <Container className="max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary">
          Status: not available yet
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-6 text-secondary">
          Hosted book-club creation and membership are not live on MANGU. There is nothing to join
          or create here yet — we are not taking waitlist signups on this page.
        </p>
        <p className="mb-8 text-secondary">
          For group reading today, pick titles from the catalog and coordinate offline (or via your
          own channels). When hosted clubs ship, this page will say so clearly.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/books">Browse books</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/book-clubs">Book club resources</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
