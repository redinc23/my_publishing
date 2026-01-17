import { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Register - MANGU',
  description: 'Create a new MANGU account',
};

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <Link href="/" className="text-3xl font-bold text-primary mb-2 block">
          MANGU
        </Link>
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Sign up to start reading and discovering books</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
        <div className="mt-4 text-center text-sm text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
