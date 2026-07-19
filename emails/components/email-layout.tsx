import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { getEmailUrl } from '@/lib/email/urls';

/**
 * Shared MANGU brand layout for all transactional email.
 *
 * Dark, Netflix-inspired palette matching the site (#0a0a0a canvas, #e50914
 * accent). All new templates in emails/ should compose this shell so the
 * brand stays consistent and footer compliance links live in exactly one
 * place.
 */
export const emailColors = {
  bg: '#0a0a0a',
  card: '#141414',
  cardAlt: '#1a1a1a',
  border: '#2a2a2a',
  text: '#ffffff',
  muted: '#a3a3a3',
  faint: '#6b6b6b',
  accent: '#e50914',
} as const;

export const emailStyles = {
  body: {
    backgroundColor: emailColors.bg,
    color: emailColors.text,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    margin: '0 auto',
  } as React.CSSProperties,
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '24px 20px 32px',
  } as React.CSSProperties,
  wordmark: {
    fontSize: '22px',
    fontWeight: 800,
    letterSpacing: '4px',
    color: emailColors.accent,
    margin: '0 0 24px',
    textAlign: 'center' as const,
  },
  heading: {
    fontSize: '24px',
    fontWeight: 700,
    color: emailColors.text,
    margin: '0 0 16px',
  } as React.CSSProperties,
  text: {
    fontSize: '15px',
    lineHeight: '24px',
    color: emailColors.text,
    margin: '0 0 14px',
  } as React.CSSProperties,
  mutedText: {
    fontSize: '13px',
    lineHeight: '20px',
    color: emailColors.muted,
    margin: '0 0 14px',
  } as React.CSSProperties,
  card: {
    backgroundColor: emailColors.card,
    border: `1px solid ${emailColors.border}`,
    borderRadius: '8px',
    padding: '16px 20px',
    margin: '0 0 20px',
  } as React.CSSProperties,
  button: {
    backgroundColor: emailColors.accent,
    color: emailColors.text,
    padding: '12px 28px',
    borderRadius: '6px',
    textDecoration: 'none',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
  } as React.CSSProperties,
  hr: {
    borderColor: emailColors.border,
    margin: '28px 0 20px',
  } as React.CSSProperties,
  footerText: {
    fontSize: '12px',
    lineHeight: '18px',
    color: emailColors.faint,
    textAlign: 'center' as const,
    margin: '0 0 6px',
  },
  footerLink: {
    color: emailColors.muted,
    textDecoration: 'underline',
  } as React.CSSProperties,
};

interface EmailLayoutProps {
  /** Inbox preview snippet shown before the email is opened. */
  preview: string;
  /** Optional footer note rendered above the standard links. */
  footerNote?: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, footerNote, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Heading as="h1" style={emailStyles.wordmark}>
            MANGU
          </Heading>
          <Section>{children}</Section>
          <Hr style={emailStyles.hr} />
          {footerNote ? <Text style={emailStyles.footerText}>{footerNote}</Text> : null}
          <Text style={emailStyles.footerText}>
            <Link href={getEmailUrl('/books')} style={emailStyles.footerLink}>
              Browse books
            </Link>
            {'  ·  '}
            <Link href={getEmailUrl('/dashboard/settings')} style={emailStyles.footerLink}>
              Email preferences
            </Link>
            {'  ·  '}
            <Link href={getEmailUrl('/contact')} style={emailStyles.footerLink}>
              Contact us
            </Link>
          </Text>
          <Text style={emailStyles.footerText}>
            © {new Date().getFullYear()} MANGU Publishers. Where stories come alive.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
