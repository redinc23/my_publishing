import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Heading,
} from '@react-email/components';

export function WelcomeEmail({ userName }: { userName: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to MANGU - Your digital publishing platform</Preview>
      <Body style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section>
            <Heading
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e50914',
                marginBottom: '20px',
              }}
            >
              Welcome to MANGU
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              Hi {userName},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              Thank you for joining MANGU, where high-quality literature meets immersive multimedia.
              Start discovering amazing books today!
            </Text>
            <Button
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/books`}
              style={{
                backgroundColor: '#e50914',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '20px',
              }}
            >
              Start Reading
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function PurchaseConfirmationEmail({
  orderNumber,
  bookTitle,
  amount,
}: {
  orderNumber: string;
  bookTitle: string;
  amount: number;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your MANGU purchase confirmation</Preview>
      <Body style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section>
            <Heading
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e50914',
                marginBottom: '20px',
              }}
            >
              Purchase Confirmed
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '8px' }}>
              Order #{orderNumber}
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '8px' }}>
              You&apos;ve purchased: <strong>{bookTitle}</strong>
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '20px' }}>
              Amount: ${amount.toFixed(2)}
            </Text>
            <Button
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reading`}
              style={{
                backgroundColor: '#e50914',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '20px',
              }}
            >
              Start Reading
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function ManuscriptSubmittedEmail({
  manuscriptTitle,
  submissionDate,
}: {
  manuscriptTitle: string;
  submissionDate: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your manuscript has been submitted</Preview>
      <Body style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section>
            <Heading
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e50914',
                marginBottom: '20px',
              }}
            >
              Manuscript Submitted
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '8px' }}>
              Your manuscript <strong>{manuscriptTitle}</strong> has been successfully submitted.
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '8px' }}>
              Submission Date: {new Date(submissionDate).toLocaleDateString()}
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '20px' }}>
              Our editorial team will review your submission and get back to you within 2-4 weeks.
            </Text>
            <Button
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/author/projects`}
              style={{
                backgroundColor: '#e50914',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '20px',
              }}
            >
              View Submission Status
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function ManuscriptStatusEmail({
  manuscriptTitle,
  status,
  notes,
}: {
  manuscriptTitle: string;
  status: string;
  notes?: string;
}) {
  const statusMessages: Record<string, string> = {
    under_review: 'Your manuscript is now under review by our editorial team.',
    revisions_requested:
      'Our editorial team has requested revisions. Please review the feedback and resubmit.',
    accepted: 'Congratulations! Your manuscript has been accepted for publication.',
    rejected: 'We regret to inform you that your manuscript was not accepted at this time.',
    published: 'Your manuscript has been published!',
  };

  return (
    <Html>
      <Head />
      <Preview>Manuscript status update: {status}</Preview>
      <Body style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section>
            <Heading
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e50914',
                marginBottom: '20px',
              }}
            >
              Manuscript Status Update
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '8px' }}>
              <strong>{manuscriptTitle}</strong>
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '8px' }}>
              Status: <strong>{status.replace('_', ' ').toUpperCase()}</strong>
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              {statusMessages[status] || 'Your manuscript status has been updated.'}
            </Text>
            {notes && (
              <Text
                style={{
                  fontSize: '14px',
                  lineHeight: '20px',
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                }}
              >
                Editorial Notes: {notes}
              </Text>
            )}
            <Button
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/author/projects`}
              style={{
                backgroundColor: '#e50914',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '20px',
              }}
            >
              View Details
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function WeeklyDigestEmail({
  userName,
  featuredBooks,
  newReleases,
}: {
  userName: string;
  featuredBooks: Array<{ title: string; slug: string }>;
  newReleases: Array<{ title: string; slug: string }>;
}) {
  return (
    <Html>
      <Head />
      <Preview>Your weekly MANGU digest</Preview>
      <Body style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section>
            <Heading
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e50914',
                marginBottom: '20px',
              }}
            >
              Your Weekly Digest
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              Hi {userName},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '20px' }}>
              Here&apos;s what&apos;s new this week on MANGU:
            </Text>

            <Heading style={{ fontSize: '20px', marginTop: '24px', marginBottom: '12px' }}>
              Featured Books
            </Heading>
            {featuredBooks.map((book) => (
              <Text key={book.slug} style={{ fontSize: '14px', lineHeight: '20px', marginBottom: '8px' }}>
                • {book.title}
              </Text>
            ))}

            <Heading style={{ fontSize: '20px', marginTop: '24px', marginBottom: '12px' }}>
              New Releases
            </Heading>
            {newReleases.map((book) => (
              <Text key={book.slug} style={{ fontSize: '14px', lineHeight: '20px', marginBottom: '8px' }}>
                • {book.title}
              </Text>
            ))}

            <Button
              href={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/books`}
              style={{
                backgroundColor: '#e50914',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '20px',
              }}
            >
              Browse Books
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function PasswordResetEmail({ resetLink }: { resetLink: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reset your MANGU password</Preview>
      <Body style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
          <Section>
            <Heading
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e50914',
                marginBottom: '20px',
              }}
            >
              Password Reset Request
            </Heading>
            <Text style={{ fontSize: '16px', lineHeight: '24px', marginBottom: '16px' }}>
              You requested to reset your password. Click the button below to create a new password.
            </Text>
            <Text style={{ fontSize: '14px', lineHeight: '20px', marginBottom: '20px', color: '#999' }}>
              This link will expire in 1 hour. If you didn&apos;t request this, you can safely ignore this email.
            </Text>
            <Button
              href={resetLink}
              style={{
                backgroundColor: '#e50914',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                display: 'inline-block',
                marginTop: '20px',
              }}
            >
              Reset Password
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
