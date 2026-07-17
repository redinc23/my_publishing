import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/discover`;

export const metadata: Metadata = {
  title: 'Discover',
  description: 'Find personalized recommendations, reading communities, and new stories on MANGU.',
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'Discover',
    description:
      'Find personalized recommendations, reading communities, and new stories on MANGU.',
    url: pageUrl,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MANGU Publishers - Your digital publishing platform',
      },
    ],
  },
};

export default function DiscoverPage() {
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Discover</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AI Recommendations</CardTitle>
              <CardDescription>
                Get personalized book recommendations based on your reading history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/discover/recommendations">Get Recommendations</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Book Clubs</CardTitle>
              <CardDescription>Join book clubs and discuss your favorite reads</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/discover/book-clubs">Browse Clubs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}
