'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface LoginFormProps {
  initialError?: string;
}

export function LoginForm({ initialError }: LoginFormProps) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
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
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
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
          <div
            id="password-error"
            role="alert"
            aria-live="polite"
            className="mt-1 text-sm text-red-500"
          >
            {errors.password.message}
          </div>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" /> : 'Sign in'}
      </Button>
    </form>
  );
}
