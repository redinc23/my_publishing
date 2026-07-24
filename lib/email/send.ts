import { Resend } from 'resend';
import {
  WelcomeEmail,
  PurchaseConfirmationEmail,
  ManuscriptSubmittedEmail,
  ManuscriptStatusEmail,
  WeeklyDigestEmail,
  PasswordResetEmail,
  ContactMessageEmail,
  NewsletterWelcomeEmail,
} from './templates';

let resend: Resend | null = null;

/**
 * True when the transactional-email provider is configured. Callers use this
 * to decide whether an email-backed feature (contact form, newsletter) is
 * available, so we never claim success for a message we cannot deliver.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Inbox that reader/support contact submissions are delivered to. */
export const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || 'books@mangu-publishers.com';

function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(to: string, subject: string, react: React.ReactElement) {
  try {
    const client = getResend();
    const { data, error } = await client.emails.send({
      from: 'MANGU <noreply@mangu.app>',
      to,
      subject,
      react,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error };
  }
}

export async function sendWelcomeEmail(user: { email: string; name: string }) {
  return sendEmail(user.email, 'Welcome to MANGU', WelcomeEmail({ userName: user.name }));
}

export async function sendPurchaseConfirmation(order: {
  email: string;
  orderNumber: string;
  bookTitle: string;
  amount: number;
}) {
  return sendEmail(
    order.email,
    `Purchase Confirmation - Order ${order.orderNumber}`,
    PurchaseConfirmationEmail({
      orderNumber: order.orderNumber,
      bookTitle: order.bookTitle,
      amount: order.amount,
    })
  );
}

export async function sendManuscriptSubmitted(data: {
  email: string;
  manuscriptTitle: string;
  submissionDate: string;
}) {
  return sendEmail(
    data.email,
    'Manuscript Submitted Successfully',
    ManuscriptSubmittedEmail({
      manuscriptTitle: data.manuscriptTitle,
      submissionDate: data.submissionDate,
    })
  );
}

export async function sendManuscriptStatusUpdate(data: {
  email: string;
  manuscriptTitle: string;
  status: string;
  notes?: string;
}) {
  return sendEmail(
    data.email,
    `Manuscript Status Update: ${data.status}`,
    ManuscriptStatusEmail({
      manuscriptTitle: data.manuscriptTitle,
      status: data.status,
      notes: data.notes,
    })
  );
}

export async function sendWeeklyDigest(data: {
  email: string;
  userName: string;
  featuredBooks: Array<{ title: string; slug: string }>;
  newReleases: Array<{ title: string; slug: string }>;
}) {
  return sendEmail(
    data.email,
    'Your Weekly MANGU Digest',
    WeeklyDigestEmail({
      userName: data.userName,
      featuredBooks: data.featuredBooks,
      newReleases: data.newReleases,
    })
  );
}

export async function sendPasswordReset(data: { email: string; resetLink: string }) {
  return sendEmail(
    data.email,
    'Reset Your MANGU Password',
    PasswordResetEmail({ resetLink: data.resetLink })
  );
}

/**
 * Deliver a contact-form submission to the support inbox. Returns the
 * {success} shape from sendEmail so the caller only reports success to the
 * user when the message was actually accepted by the provider.
 */
export async function sendContactMessage(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  return sendEmail(
    CONTACT_INBOX,
    `[Contact] ${data.subject}`,
    ContactMessageEmail({
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
    })
  );
}

/**
 * Subscribe an email to the newsletter. When RESEND_AUDIENCE_ID is set the
 * address is added to that Resend audience; otherwise we fall back to sending
 * a welcome confirmation. Either path only resolves success on a real 2xx.
 */
export async function subscribeToNewsletter(email: string) {
  try {
    const client = getResend();
    const audienceId = process.env.RESEND_AUDIENCE_ID?.trim();

    if (audienceId) {
      const { error } = await client.contacts.create({
        email,
        audienceId,
        unsubscribed: false,
      });
      if (error) {
        console.error('Newsletter subscribe (audience) error:', error);
        return { success: false as const, error };
      }
      return { success: true as const };
    }

    // No audience configured — confirm the subscription with a welcome email.
    const result = await sendEmail(
      email,
      'Welcome to the MANGU newsletter',
      NewsletterWelcomeEmail({ email })
    );
    return result.success
      ? { success: true as const }
      : { success: false as const, error: result.error };
  } catch (error) {
    console.error('Newsletter subscribe failed:', error);
    return { success: false as const, error };
  }
}
