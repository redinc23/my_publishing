import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, emailColors, emailStyles } from './components/email-layout';
import { getEmailUrl } from '@/lib/email/urls';

export interface NewReviewAlertEmailProps {
  authorName: string;
  bookTitle: string;
  /** Star rating 1–5. */
  rating: number;
  reviewTitle?: string;
  /** Short excerpt of the review body. */
  reviewExcerpt?: string;
  reviewerName?: string;
  /** Absolute URL to the book's reviews page. */
  reviewUrl?: string;
}

function renderStars(rating: number): string {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(clamped)}${'☆'.repeat(5 - clamped)}`;
}

/**
 * Sent to a book's author when a reader publishes a new public review. Wired
 * by the reviews system via lib/email/triggers.ts#notifyAuthorOfNewReview.
 */
export function NewReviewAlertEmail({
  authorName,
  bookTitle,
  rating,
  reviewTitle,
  reviewExcerpt,
  reviewerName,
  reviewUrl,
}: NewReviewAlertEmailProps) {
  return (
    <EmailLayout
      preview={`New ${rating}-star review of ${bookTitle}`}
      footerNote="You're receiving this because you're the author of this book. Manage alerts in your email preferences."
    >
      <Heading as="h2" style={emailStyles.heading}>
        New review of {bookTitle}
      </Heading>
      <Text style={emailStyles.text}>Hi {authorName},</Text>
      <Text style={emailStyles.text}>
        {reviewerName ? <strong>{reviewerName} </strong> : 'A reader '}just left a review on{' '}
        <strong>{bookTitle}</strong>.
      </Text>
      <Section style={emailStyles.card}>
        <Text
          style={{
            fontSize: '18px',
            letterSpacing: '2px',
            color: emailColors.accent,
            margin: '0 0 8px',
          }}
        >
          {renderStars(rating)}{' '}
          <span style={{ color: emailColors.muted, fontSize: '14px', letterSpacing: 0 }}>
            ({rating}/5)
          </span>
        </Text>
        {reviewTitle ? (
          <Text style={{ ...emailStyles.text, fontWeight: 700, margin: '0 0 6px' }}>
            {reviewTitle}
          </Text>
        ) : null}
        {reviewExcerpt ? (
          <Text style={{ ...emailStyles.mutedText, margin: 0 }}>
            &ldquo;{reviewExcerpt}&rdquo;
          </Text>
        ) : null}
      </Section>
      <Button href={reviewUrl ?? getEmailUrl('/dashboard/my-reviews')} style={emailStyles.button}>
        Read the Full Review
      </Button>
    </EmailLayout>
  );
}

export default NewReviewAlertEmail;
