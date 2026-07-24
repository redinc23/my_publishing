import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export const metadata: Metadata = {
  title: 'FAQs',
  description: 'Frequently asked questions about reading and publishing on Mangu Publishers.',
};

const faqs = [
  {
    question: 'How do I buy a book?',
    answer:
      'Open any book page and select Purchase. After checkout, the book is added to your library instantly and you can start reading right away.',
  },
  {
    question: 'Where do I find books I have purchased?',
    answer:
      'All of your purchases live in your Library. Sign in and open the Library page from the header to see everything you own.',
  },
  {
    question: 'Can I read on multiple devices?',
    answer:
      'Yes. Your library and reading progress sync with your account, so you can pick up where you left off on any device with a browser.',
  },
  {
    question: 'How do I submit a manuscript?',
    answer:
      'Create an account, then head to the author portal and choose Submit. Fill in the manuscript details and our editorial team will review your submission.',
  },
  {
    question: 'How are author royalties calculated?',
    answer:
      'Authors earn a percentage of every sale as defined in their agreement. Earnings and payouts are visible in the author analytics dashboard.',
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Use the Forgot password link on the login page. We will email you a secure link to choose a new password.',
  },
  {
    question: 'Do you offer refunds?',
    answer:
      'If something went wrong with a purchase, contact support within 14 days and we will make it right.',
  },
];

export default function FaqsPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-2 text-4xl font-bold">Frequently Asked Questions</h1>
          <p className="mb-8 text-secondary">
            Can&apos;t find what you&apos;re looking for? Visit the{' '}
            <Link href="/help" className="text-primary hover:underline">
              Help Center
            </Link>{' '}
            or{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>
            .
          </p>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card px-6 py-4">
                <summary className="cursor-pointer list-none text-base font-semibold marker:hidden">
                  {faq.question}
                </summary>
                <p className="mt-3 text-secondary">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
