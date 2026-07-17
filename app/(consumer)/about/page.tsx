import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { getSiteUrl } from '@/lib/seo/siteUrl';

const pageUrl = `${getSiteUrl()}/about`;
const description =
  'Learn how MANGU Publishers connects readers with fresh voices and independent authors worldwide.';

export const metadata: Metadata = {
  title: 'About MANGU',
  description,
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'About MANGU',
    description,
    url: pageUrl,
  },
};

export default function AboutPage() {
  return (
    <Section>
      <Container>
        <h1 className="mb-4 text-4xl font-bold">About MANGU</h1>
        <p className="max-w-2xl text-secondary">
          MANGU connects readers with fresh voices from around the world. We spotlight independent
          authors, deliver immersive reading experiences, and make it easy to discover your next
          favorite book.
        </p>
      </Container>
    </Section>
  );
}
