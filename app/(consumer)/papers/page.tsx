import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { FEATURE_PAPERS } from '@/lib/flags';

export const metadata: Metadata = {
  title: FEATURE_PAPERS ? 'Papers' : 'Papers — Not available yet',
  description: FEATURE_PAPERS
    ? 'Browse academic papers, research, and long-form nonfiction on MANGU Publishers.'
    : 'Academic papers are not available on MANGU yet. Browse the ebook catalog meanwhile.',
  ...(FEATURE_PAPERS ? {} : { robots: { index: false } }),
};

export default function PapersPage() {
  if (!FEATURE_PAPERS) {
    return (
      <Section>
        <Container>
          <p
            className="mb-3 text-sm font-medium uppercase tracking-wide text-secondary"
            role="status"
          >
            Not available yet
          </p>
          <h1 className="mb-4 text-4xl font-bold">Papers</h1>
          <p className="mb-8 max-w-2xl text-secondary">
            MANGU does not offer academic papers today. When they ship, this page will say so
            clearly.
          </p>
          <Button asChild variant="secondary">
            <Link href="/books">Browse ebooks instead</Link>
          </Button>
        </Container>
      </Section>
    );
  }

  // FEATURE_PAPERS=true path — full catalog (built when flag is enabled)
  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Browse Papers</h1>
        <p className="text-secondary">Papers catalog coming soon.</p>
      </Container>
    </Section>
  );
}
