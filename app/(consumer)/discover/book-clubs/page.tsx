import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs',
  description:
    'MANGU book clubs are not available yet. Discover working catalog and reader tools instead.',
};

/**
 * Discover entry for book clubs — honest placeholder (Enhancement E-001 / G6).
 * Do not imply live clubs, join flows, or member counts.
 */
export default function DiscoverBookClubsPage() {
  return (
    <Section>
      <Container>
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary">
          Status: not available yet
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mx-auto mb-8 max-w-2xl text-secondary">
          Community book clubs are planned but not built. This Discover page does not list clubs and
          does not accept joins. Use the links below for features that already work.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/books">Browse books</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/discover">Back to Discover</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/book-clubs">Book clubs status</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
