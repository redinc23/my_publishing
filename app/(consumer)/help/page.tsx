import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookOpen, CreditCard, PenTool, User, Headphones, MessageCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find answers and get support for reading, purchasing, and publishing on Mangu.',
};

const topics = [
  {
    icon: BookOpen,
    title: 'Reading & Library',
    description: 'Access purchased books, track reading progress, and manage your library.',
    href: '/library',
  },
  {
    icon: CreditCard,
    title: 'Purchases & Billing',
    description: 'Payment methods, receipts, refunds, and subscription questions.',
    href: '/faqs',
  },
  {
    icon: PenTool,
    title: 'Publishing with Mangu',
    description: 'Submit manuscripts, track review status, and understand royalties.',
    href: '/author/submit',
  },
  {
    icon: User,
    title: 'Account & Profile',
    description: 'Update your details, reset your password, and manage preferences.',
    href: '/reset-password',
  },
  {
    icon: Headphones,
    title: 'Audiobooks',
    description: 'Listening on the web, playback issues, and supported formats.',
    href: '/audio',
  },
  {
    icon: MessageCircle,
    title: 'Contact Support',
    description: 'Still stuck? Our team is happy to help with anything else.',
    href: '/contact',
  },
];

export default function HelpPage() {
  return (
    <div>
      <Section className="bg-muted">
        <Container>
          <h1 className="mb-2 text-4xl font-bold">Help Center</h1>
          <p className="max-w-2xl text-secondary">
            Browse common topics below, check the{' '}
            <Link href="/faqs" className="text-primary hover:underline">
              FAQs
            </Link>
            , or{' '}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>{' '}
            directly.
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((topic) => (
              <Link key={topic.title} href={topic.href} className="group">
                <div className="h-full rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-md">
                  <topic.icon className="mb-4 h-8 w-8 text-primary" />
                  <h2 className="mb-2 text-xl font-semibold group-hover:text-primary">
                    {topic.title}
                  </h2>
                  <p className="text-sm text-secondary">{topic.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </Section>
    </div>
  );
}
