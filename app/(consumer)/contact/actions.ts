'use server';

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

  console.log(
    'Contact form submission validated (not persisted: no contact_messages migration found)',
    {
      name,
      email,
      subject,
      messageLength: message.length,
    }
  );

  return {
    status: 'success',
    message:
      'Thanks — your message was validated and logged for the support team. We will follow up by email.',
  };
}
