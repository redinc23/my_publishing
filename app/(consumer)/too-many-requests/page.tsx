import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Too many requests',
  description: 'Please wait a moment before trying again.',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams?: { retry?: string; reason?: string };
};

export default function TooManyRequestsPage({ searchParams }: PageProps) {
  const retry = Number(searchParams?.retry);
  const retrySeconds = Number.isFinite(retry) && retry > 0 ? Math.floor(retry) : null;
  const unavailable = searchParams?.reason === 'unavailable';

  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-lg py-16 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wide text-secondary">
            {unavailable ? 'Temporarily unavailable' : 'Slow down'}
          </p>
          <h1 className="mb-4 text-3xl font-bold">Too many requests</h1>
          <p className="mb-6 text-secondary">
            {unavailable
              ? 'Our safety limiter is having trouble right now. Please try again in a moment.'
              : 'You hit a short rate limit that protects the site for everyone.'}
            {retrySeconds != null ? (
              <>
                {' '}
                Suggested wait: about <strong>{retrySeconds}</strong> second
                {retrySeconds === 1 ? '' : 's'}.
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/">Back home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/books">Browse books</Link>
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
