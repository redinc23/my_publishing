import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Book Clubs',
  description: 'Find MANGU reader resources for choosing, organizing, and discussing group reads.',
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
        <h1 className="mb-4 text-4xl font-bold">Book Clubs</h1>
        <p className="mb-8 max-w-2xl text-secondary">
          Book club creation is coming soon. In the meantime, use these working resources to choose
          and organize your next read.
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
