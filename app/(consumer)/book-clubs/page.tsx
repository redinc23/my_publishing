import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Book Clubs — reader resources',
  description:
    'Hosted book clubs are not live yet. Use these MANGU reader resources to choose and organize a group read.',
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

export default function BookClubsPage() {
  return (
    <Section>
      <Container>
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary">
          Reader resources
        </p>
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-3 max-w-2xl text-secondary">
          Hosted book-club creation is not available yet. This page lists working MANGU tools you
          can use today to pick and discuss a group read — not a live clubs product.
        </p>
        <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
          Want to be notified when clubs launch? Use Contact from the site footer.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {clubLinks.map((item) => (
            <Card key={item.href}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={item.href}>{item.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
