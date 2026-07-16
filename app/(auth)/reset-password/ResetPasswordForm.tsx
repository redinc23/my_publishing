'use client';

import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPassword } from './actions';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const resetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ResetFormData = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: 'onSubmit',
  });

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('email', data.email);

      const result = await resetPassword(formData);

      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-green-500 bg-green-500/10 p-4 text-sm text-green-500"
      >
        Check your email for a password reset link. If you don&apos;t see it, check your spam
        folder.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      aria-label="Reset password form"
      noValidate
    >
      {/* Live region announces errors to screen readers without focus change */}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div
            id={errorId}
            role="alert"
            className="rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}
      </div>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={!!errors.email}
          {...register('email')}
          disabled={isLoading}
        />
        {errors.email && (
          <div
            id="email-error"
            role="alert"
            aria-live="polite"
            className="mt-1 text-sm text-red-500"
          >
            {errors.email.message}
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" /> : 'Send reset link'}
      </Button>
    </form>
  );
}
