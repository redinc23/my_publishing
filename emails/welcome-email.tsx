import { Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailStyles } from './components/email-layout';
import { getEmailUrl } from '@/lib/email/urls';

export interface WelcomeEmailProps {
  userName: string;
}

export function WelcomeEmail({ userName }: WelcomeEmailProps) {
  const displayName = userName.trim() || 'Reader';
  return (
    <EmailLayout preview="Welcome to MANGU — discover your next great read.">
      <Heading as="h2" style={emailStyles.heading}>
        Welcome, {displayName}
      </Heading>
      <Text style={emailStyles.text}>
        Your MANGU account is ready. Explore independent stories, follow authors, and keep your
        reading life together in one place.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Link href={getEmailUrl('/books')} style={emailStyles.button}>
          Browse the catalog
        </Link>
      </Section>
      <Text style={emailStyles.mutedText}>
        You can update your email preferences at any time from your account settings.
      </Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;
