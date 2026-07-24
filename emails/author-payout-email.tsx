import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailStyles } from './components/email-layout';
import { getEmailUrl } from '@/lib/email/urls';

export interface AuthorPayoutEmailProps {
  authorName: string;
  /** Pre-formatted amount, e.g. "$142.50". */
  amount: string;
  /** Payout status label, e.g. "processed" or "scheduled". */
  status?: string;
  /** Human-readable payout period, e.g. "June 2026". */
  period?: string;
  /** Absolute URL to the author's earnings dashboard. */
  dashboardUrl?: string;
}

/**
 * Sent to an author when a royalty payout is processed (or scheduled) by the
 * payouts system.
 */
export function AuthorPayoutEmail({
  authorName,
  amount,
  status = 'processed',
  period,
  dashboardUrl,
}: AuthorPayoutEmailProps) {
  return (
    <EmailLayout
      preview={`Your MANGU payout of ${amount} has been ${status}`}
      footerNote="Questions about a payout? Reply to this email or visit your author dashboard."
    >
      <Heading as="h2" style={emailStyles.heading}>
        Payout {status}
      </Heading>
      <Text style={emailStyles.text}>Hi {authorName},</Text>
      <Text style={emailStyles.text}>
        A royalty payout of <strong>{amount}</strong>
        {period ? (
          <>
            {' '}
            for <strong>{period}</strong>
          </>
        ) : null}{' '}
        has been {status}. Funds typically land within 2–5 business days depending on your payout
        method.
      </Text>
      <Section style={emailStyles.card}>
        <Text style={{ ...emailStyles.mutedText, margin: 0 }}>
          Amount: <strong style={{ color: '#ffffff' }}>{amount}</strong>
          {period ? (
            <>
              <br />
              Period: {period}
            </>
          ) : null}
          <br />
          Status: {status}
        </Text>
      </Section>
      <Button href={dashboardUrl ?? getEmailUrl('/author/earnings')} style={emailStyles.button}>
        View Earnings
      </Button>
    </EmailLayout>
  );
}

export default AuthorPayoutEmail;
