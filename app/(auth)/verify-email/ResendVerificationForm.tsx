'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { resendVerificationEmail } from './actions';

interface ResendVerificationFormProps {
  email: string;
}

export function ResendVerificationForm({ email }: ResendVerificationFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const handleResend = async () => {
    setStatus('loading');
    setMessage('');

    const result = await resendVerificationEmail(email);

    if (result?.error) {
      setStatus('error');
      setMessage(result.error);
    } else {
      setStatus('success');
      setMessage('Verification email sent! Please check your inbox.');
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleResend}
        disabled={status === 'loading'}
        variant="outline"
        className="w-full"
      >
        {status === 'loading' ? 'Sending...' : 'Resend Verification Email'}
      </Button>
      {message && (
        <p
          className={`text-sm ${
            status === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
