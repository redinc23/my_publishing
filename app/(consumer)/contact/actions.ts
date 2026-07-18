'use server';

import { isEmailConfigured, sendContactMessage } from '@/lib/email/send';

export type ContactFormState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  fieldErrors?: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };
};

function readField(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

export async function submitContactMessage(
  _previousState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  const name = readField(formData, 'name');
  const email = readField(formData, 'email');
  const subject = readField(formData, 'subject');
  const message = readField(formData, 'message');

  const fieldErrors: ContactFormState['fieldErrors'] = {};

  if (name.length < 2) fieldErrors.name = 'Enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'Enter a valid email.';
  if (subject.length < 3) fieldErrors.subject = 'Enter a subject.';
  if (message.length < 10) fieldErrors.message = 'Enter at least 10 characters.';

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: 'error',
      message: 'Please fix the highlighted fields.',
      fieldErrors,
    };
  }

  // Honest scope (CCR-018): never claim delivery we can't perform. When email
  // is not configured the form is not rendered (the page shows a mailto
  // fallback); this guard is defense in depth for a direct action invocation.
  if (!isEmailConfigured()) {
    return {
      status: 'error',
      message:
        'Our contact form is temporarily unavailable. Please email us directly at books@mangu-publishers.com.',
    };
  }

  const result = await sendContactMessage({ name, email, subject, message });

  if (!result.success) {
    return {
      status: 'error',
      message:
        'Sorry — we could not send your message just now. Please email us directly at books@mangu-publishers.com.',
    };
  }

  return {
    status: 'success',
    message: 'Thanks — your message was sent to our support team. We will follow up by email.',
  };
}
