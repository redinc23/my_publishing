import { Button, Heading, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailStyles } from './components/email-layout';

export interface NewsletterConfirmEmailProps {
  /** Absolute double opt-in confirmation URL (contains one-time token). */
  confirmUrl: string;
  /** The address being confirmed, shown for transparency. */
  email?: string;
}

/**
 * Double opt-in confirmation for newsletter signups. The subscription is only
 * activated after the recipient clicks the confirmation link.
 */
export function NewsletterConfirmEmail({ confirmUrl, email }: NewsletterConfirmEmailProps) {
  return (
    <EmailLayout
      preview="Confirm your MANGU newsletter subscription"
      footerNote="If you didn't request this, you can safely ignore this email — no subscription will be created."
    >
      <Heading as="h2" style={emailStyles.heading}>
        Confirm your subscription
      </Heading>
      <Text style={emailStyles.text}>
        {email ? (
          <>
            Thanks for subscribing to the MANGU newsletter with <strong>{email}</strong>.
          </>
        ) : (
          'Thanks for subscribing to the MANGU newsletter.'
        )}{' '}
        One last step: confirm your address to start getting personalized book recommendations and
        exclusive author updates.
      </Text>
      <Button href={confirmUrl} style={emailStyles.button}>
        Confirm Subscription
      </Button>
      <Text style={{ ...emailStyles.mutedText, marginTop: '18px' }}>
        This link expires in 7 days. If the button doesn&apos;t work, copy and paste this URL into
        your browser:
        <br />
        {confirmUrl}
      </Text>
    </EmailLayout>
  );
}

export default NewsletterConfirmEmail;
