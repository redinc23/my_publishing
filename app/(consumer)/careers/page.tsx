import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Join the team building the future of digital publishing.',
};

const values = [
  {
    title: 'Readers first',
    description: 'Every decision starts with what makes reading better.',
  },
  {
    title: 'Champion authors',
    description: 'We build tools that help storytellers earn a living from their craft.',
  },
  {
    title: 'Stay curious',
    description: 'Books are about learning — so is working here.',
  },
];

export default function CareersPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">Careers at Mangu</h1>
          <p className="max-w-2xl text-secondary">
            We&apos;re a small team on a mission to connect readers with stories they&apos;ll love
            and help authors thrive.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="mb-6 text-2xl font-semibold">What we value</h2>
          <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {values.map((value) => (
              <div key={value.title} className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-2 text-lg font-semibold">{value.title}</h3>
                <p className="text-sm text-secondary">{value.description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h2 className="mb-2 text-2xl font-semibold">No open roles right now</h2>
            <p className="mx-auto mb-6 max-w-xl text-secondary">
              We&apos;re not actively hiring at the moment, but we&apos;re always excited to meet
              people who love books and technology. Send us a note and we&apos;ll keep you in mind.
            </p>
            <Button asChild>
              <Link href="/contact">Get in touch</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </div>
  );
}
