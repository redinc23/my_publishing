import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export function PartnerUnavailable({
  title = 'Partner portal unavailable',
  message = 'Partner portal data is temporarily unavailable. Please try again shortly.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Section>
      <Container>
        <h1 className="mb-4 text-2xl font-bold">{title}</h1>
        <p className="text-secondary" role="alert">
          {message}
        </p>
      </Container>
    </Section>
  );
}
