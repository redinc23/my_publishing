import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs — Not available yet',
  description:
    'Hosted book clubs are not available on MANGU yet. Browse the catalog meanwhile.',
};

/** Discover alias — same honest unavailable status as `/book-clubs` (E-001). */
export default function DiscoverBookClubsPage() {
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
          Hosted clubs are not live on MANGU. This page is a placeholder, not a directory of
          clubs you can join.
        </p>
        <Button asChild variant="secondary">
          <Link href="/books">Browse catalog instead</Link>
        </Button>
      </Container>
    </Section>
  );
}
