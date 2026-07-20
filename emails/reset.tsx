import { Heading, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailStyles } from './components/email-layout';

export interface ResetEmailProps {
  userName?: string;
  resetUrl: string;
  /** When true, copy targets legacy Supabase users after Phoenix import. */
  legacyWelcome?: boolean;
}

/**
 * Branded password-reset / forced-reset email (Phoenix WS1.7).
 */
export function ResetEmail({ userName, resetUrl, legacyWelcome = false }: ResetEmailProps) {
  const displayName = userName?.trim() || 'Reader';
  const preview = legacyWelcome
    ? 'Welcome to the new Mangu — set your password to continue.'
    : 'Reset your MANGU password';

  return (
    <EmailLayout preview={preview}>
      <Heading as="h2" style={emailStyles.heading}>
        {legacyWelcome ? 'Welcome to the new Mangu' : 'Reset your password'}
      </Heading>
      <Text style={emailStyles.text}>Hi {displayName},</Text>
      {legacyWelcome ? (
        <Text style={emailStyles.text}>
          We upgraded MANGU&apos;s sign-in system. For your security, legacy passwords were not
          carried over. Use the button below to set a new password and get back to reading.
        </Text>
      ) : (
        <Text style={emailStyles.text}>
          We received a request to reset your MANGU password. Click below to choose a new one.
          This link expires in one hour.
        </Text>
      )}
      <Section style={{ margin: '24px 0' }}>
        <Link href={resetUrl} style={emailStyles.button}>
          {legacyWelcome ? 'Set your new password' : 'Reset password'}
        </Link>
      </Section>
      <Text style={emailStyles.mutedText}>
        If you did not request this, you can ignore this email — your account stays secure.
      </Text>
    </EmailLayout>
  );
}

export default ResetEmail;
