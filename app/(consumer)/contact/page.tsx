import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { ContactForm } from './ContactForm';
export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact MANGU Publishers for reader support, publishing questions, and media inquiries.',
};

export default function ContactPage() {
  return (
    <Section>
      <Container>
        <h1 className="mb-4 text-4xl font-bold">Contact</h1>
        <p className="max-w-2xl text-secondary">
          Have a question or need support? Email us at{' '}
          <a className="text-primary hover:underline" href="mailto:support@mangu.com">
            support@mangu.com
          </a>
          . We&apos;ll get back to you within two business days.
        </p>
        <ContactForm />
      </Container>
    </Section>
  );
}
