'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { submitContactMessage, type ContactFormState } from './actions';

const initialContactFormState: ContactFormState = {
  status: 'idle',
  message: '',
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Send message'}
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactMessage, initialContactFormState);

  return (
    <form action={formAction} className="mt-8 max-w-2xl space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="name">
          Name
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          id="name"
          name="name"
          required
          minLength={2}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          id="email"
          name="email"
          required
          type="email"
        />
        {state.fieldErrors?.email && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="subject">
          Subject
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          id="subject"
          name="subject"
          required
          minLength={3}
        />
        {state.fieldErrors?.subject && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.subject}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="message">
          Message
        </label>
        <textarea
          className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2"
          id="message"
          name="message"
          required
          minLength={10}
        />
        {state.fieldErrors?.message && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.message}</p>
        )}
      </div>

      {state.message && (
        <p
          className={state.status === 'success' ? 'text-sm text-green-700' : 'text-sm text-red-600'}
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
