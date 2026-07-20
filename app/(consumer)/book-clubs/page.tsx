import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs — Not available yet',
  description:
    'Hosted book clubs are not available on MANGU yet. Browse the catalog and readers hub meanwhile.',
};

/**
 * Honest unavailable surface (E-001 / G6).
 * Do not present join/browse/create CTAs for clubs that do not exist.
 */
export default function BookClubsPage() {
  return (
    <Section>
      <Container>
        <p
          className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary"
          role="status"
        >
          Not available yet
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-8 max-w-2xl text-secondary">
          MANGU does not host book clubs today. There is nothing to join or browse here yet —
          when clubs ship, this page will say so clearly. Until then, these working tools help
          you pick and track group reads on your own:
        </p>
        <ul className="flex flex-wrap gap-3">
          <li>
            <Button asChild variant="secondary">
              <Link href="/books">Browse catalog</Link>
            </Button>
          </li>
          <li>
            <Button asChild variant="secondary">
              <Link href="/genres">Explore genres</Link>
            </Button>
          </li>
          <li>
            <Button asChild variant="secondary">
              <Link href="/readers-hub">Readers hub</Link>
            </Button>
          </li>
        </ul>
      </Container>
    </Section>
  );
}
