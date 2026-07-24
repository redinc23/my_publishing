import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/blog`;
const description = 'News, publishing insights, and stories from the Mangu Publishers team.';

export const metadata: Metadata = {
  title: 'Blog',
  description,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'Blog',
    description,
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

export default function BlogPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">The Mangu Blog</h1>
          <p className="max-w-2xl text-secondary">
            News, publishing insights, and stories from the team.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-2xl font-semibold">First post coming soon</h2>
            <p className="mx-auto mb-6 max-w-xl text-secondary">
              We&apos;re working on our first stories. In the meantime, explore what&apos;s trending
              on the platform.
            </p>
            <Button asChild>
              <Link href="/books">Browse Books</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
