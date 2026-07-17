import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export const metadata: Metadata = {
  title: 'Press Kit',
  description: 'Company facts, brand assets, and media contact for Mangu Publishers.',
};

export default function PressPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">Press Kit</h1>
          <p className="max-w-2xl text-secondary">
            Everything you need to write about Mangu Publishers.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="mx-auto max-w-3xl space-y-8">
            <section>
              <h2 className="mb-2 text-2xl font-semibold">About Mangu Publishers</h2>
              <p className="text-secondary">
                Mangu Publishers is a digital publishing platform that connects readers with books,
                audiobooks, comics, and academic papers, while giving authors a direct way to
                publish and earn from their work.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold">Fast facts</h2>
              <ul className="list-inside list-disc space-y-1 text-secondary">
                <li>Multi-format catalog: e-books, audiobooks, comics, and papers</li>
                <li>Direct manuscript submissions with editorial review</li>
                <li>Transparent royalty reporting for authors</li>
                <li>Personalized recommendations for readers</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold">Brand</h2>
              <p className="text-secondary">
                Please write our name as <strong className="text-foreground">MANGU</strong> or{' '}
                <strong className="text-foreground">Mangu Publishers</strong>. Do not alter the logo
                colors or proportions when using brand assets.
              </p>
            </section>

            <section>
              <h2 className="mb-2 text-2xl font-semibold">Media contact</h2>
              <p className="text-secondary">
                For interviews, assets, or press inquiries, reach us through the{' '}
                <Link href="/contact" className="text-primary hover:underline">
                  contact page
                </Link>
                .
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
