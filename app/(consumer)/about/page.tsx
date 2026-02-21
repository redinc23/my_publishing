import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export default function AboutPage() {
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-4">About MANGU</h1>
        <p className="text-secondary max-w-2xl">
          MANGU connects readers with fresh voices from around the world. We spotlight independent
          authors, deliver immersive reading experiences, and make it easy to discover your next
          favorite book.
        </p>
      </Container>
    </Section>
  );
}
