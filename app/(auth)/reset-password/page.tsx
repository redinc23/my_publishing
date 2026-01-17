import { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from './ResetPasswordForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Reset Password - MANGU',
  description: 'Reset your MANGU account password',
};

export default function ResetPasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link href="/" className="text-3xl font-bold text-primary mb-2 block">
          MANGU
        </Link>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>Enter your email to receive a password reset link</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
        <div className="mt-4 text-center text-sm text-secondary">
          Remember your password?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
