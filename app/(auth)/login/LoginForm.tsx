'use client';

import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from './actions';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Surface errors forwarded via URL (e.g. from OAuth callback failures).
  useEffect(() => {
    const urlError = searchParams?.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);

      const result = await signIn(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      } else {
        // Full-page navigation so the client-side Supabase session picks up
        // the auth cookies set by the server action.
        window.location.assign('/');
      }
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      aria-label="Sign in form"
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
          <p id="email-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={!!errors.password}
          {...register('password')}
          disabled={isLoading}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="mt-1 text-sm text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" /> : 'Sign in'}
      </Button>
    </form>
  );
}
