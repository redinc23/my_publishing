import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailStyles } from './components/email-layout';
import { getEmailUrl } from '@/lib/email/urls';

export interface WelcomeEmailProps {
  userName: string;
}

/**
 * Sent once after a reader creates an account (register flow trigger).
 */
export function WelcomeEmail({ userName }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to MANGU — your next great read is waiting">
      <Heading as="h2" style={emailStyles.heading}>
        Welcome to MANGU, {userName}
      </Heading>
      <Text style={emailStyles.text}>
        Your account is ready. MANGU pairs high-quality literature with immersive multimedia —
        trailers, audio, and a reading experience built for the way you actually read.
      </Text>
      <Text style={emailStyles.text}>Here&apos;s what to do first:</Text>
      <Text style={emailStyles.mutedText}>
        1. Browse the catalog and add books to your reading list.
        <br />
        2. Follow your favorite authors to hear about new releases.
        <br />
        3. Leave reviews — authors read every one.
      </Text>
      <Button href={getEmailUrl('/books')} style={emailStyles.button}>
        Start Reading
      </Button>
    </EmailLayout>
  );
}

export default WelcomeEmail;
