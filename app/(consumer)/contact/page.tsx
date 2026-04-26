import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export default function ContactPage() {
  return (
    <Section>
      <Container>
        <h1 className="text-4xl font-bold mb-4">Contact</h1>
        <p className="text-secondary max-w-2xl">
          Have a question or need support? Email us at{' '}
          <a className="text-primary hover:underline" href="mailto:support@mangu.com">
            support@mangu.com
          </a>
          . We&apos;ll get back to you within two business days.
        </p>
      </Container>
    </Section>
  );
}
