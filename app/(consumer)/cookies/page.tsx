import type { Metadata } from 'next';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';

export const metadata: Metadata = {
  title: 'Cookie Settings',
  description: 'Learn about the cookies Mangu Publishers uses and how to manage them.',
};

const cookieTypes = [
  {
    name: 'Essential Cookies',
    required: true,
    description:
      'Required for the platform to function — they keep you signed in and secure your session. These cannot be disabled.',
  },
  {
    name: 'Preference Cookies',
    required: false,
    description:
      'Remember your settings such as theme and language so you get a consistent experience across visits.',
  },
  {
    name: 'Analytics Cookies',
    required: false,
    description:
      'Help us understand how readers use the platform so we can improve it. Data is aggregated and anonymized.',
  },
];

export default function CookiesPage() {
  return (
    <Section>
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Cookie Settings</h1>
            <p className="text-secondary">
              We use a small number of cookies to run Mangu Publishers. Here&apos;s what each type
              does.
            </p>
          </div>

          <div className="space-y-4">
            {cookieTypes.map((cookie) => (
              <div key={cookie.name} className="rounded-lg border border-border bg-card p-6">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{cookie.name}</h2>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-secondary">
                    {cookie.required ? 'Always on' : 'Optional'}
                  </span>
                </div>
                <p className="text-secondary">{cookie.description}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-secondary">
            You can also control cookies through your browser settings. Blocking essential cookies
            will prevent you from signing in. For more details, see our{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </Container>
    </Section>
  );
}
