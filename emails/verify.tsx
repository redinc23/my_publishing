import { Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailStyles } from './components/email-layout';

export interface VerifyEmailProps {
  userName?: string;
  verifyUrl: string;
}

export function VerifyEmail({ userName, verifyUrl }: VerifyEmailProps) {
  const displayName = userName?.trim() || 'Reader';
  return (
    <EmailLayout preview="Verify your MANGU email to finish signup.">
      <Heading as="h2" style={emailStyles.heading}>
        Confirm your email
      </Heading>
      <Text style={emailStyles.text}>Hi {displayName},</Text>
      <Text style={emailStyles.text}>
        Thanks for joining MANGU. Confirm your email address to activate your account.
      </Text>
      <Section style={{ margin: '24px 0' }}>
        <Link href={verifyUrl} style={emailStyles.button}>
          Verify email
        </Link>
      </Section>
      <Text style={emailStyles.mutedText}>This link expires in one hour.</Text>
    </EmailLayout>
  );
}

export default VerifyEmail;
