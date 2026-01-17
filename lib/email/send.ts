import { Resend } from 'resend';
import {
  WelcomeEmail,
  PurchaseConfirmationEmail,
  ManuscriptSubmittedEmail,
  ManuscriptStatusEmail,
  WeeklyDigestEmail,
  PasswordResetEmail,
} from './templates';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(
  to: string,
  subject: string,
  react: React.ReactElement
) {
  try {
    const { data, error } = await resend.emails.send({
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
  return sendEmail(
    user.email,
    'Welcome to MANGU',
    WelcomeEmail({ userName: user.name })
  );
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
