import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Book Clubs (not available yet)',
  description:
    'Hosted book clubs are not available on MANGU yet. Use catalog and reader tools to plan group reads.',
};

const clubLinks = [
  {
    title: 'Browse books',
    description: 'Pick your next group read from the public catalog.',
    href: '/books',
    cta: 'Browse books',
  },
  {
    title: 'Explore genres',
    description: 'Find discussion ideas by genre and theme.',
    href: '/genres',
    cta: 'View genres',
  },
  {
    title: 'Reader tools',
    description: 'Manage your reading activity from the readers hub.',
    href: '/readers-hub',
    cta: 'Open readers hub',
  },
];

/**
 * Honest placeholder (enhancement E-001 / NEXT_GO G6).
 * No fake join/create CTAs; status is explicit.
 */
export default function BookClubsPage() {
  return (
    <Section>
      <Container>
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary">
          Status: not available yet
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-4 max-w-2xl text-secondary">
          Hosted book-club creation and membership are not live. This page does not accept club
          signups or waitlist emails.
        </p>
        <p className="mb-8 max-w-2xl text-secondary">
          Meanwhile, these working resources help you choose and organize a group read on your own:
        </p>
        <ul className="grid list-none gap-8 p-0 md:grid-cols-3">
          {clubLinks.map((item) => (
            <li key={item.href}>
              <h2 className="mb-2 text-xl font-semibold">{item.title}</h2>
              <p className="mb-4 text-secondary">{item.description}</p>
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
