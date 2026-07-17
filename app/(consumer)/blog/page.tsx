import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, publishing insights, and stories from the Mangu Publishers team.',
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
              We&apos;re working on our first stories. In the meantime, explore what&apos;s
              trending on the platform.
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
