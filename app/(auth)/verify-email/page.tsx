/* eslint-disable */
import { Suspense } from 'react';
import { Container } from '@/components/layout/Container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ResendVerificationForm } from './ResendVerificationForm';

async function checkVerificationStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return {
    email: user.email,
    emailConfirmed: user.email_confirmed_at !== null,
  };
}

export default async function VerifyEmailPage() {
  const { email, emailConfirmed } = await checkVerificationStatus();

  if (emailConfirmed) {
    redirect('/');
  }

  return (
    <Container className="flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            We've sent a verification email to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              Please check your email and click the verification link to activate your account.
            </p>
          </div>

          <Suspense fallback={<div>Loading...</div>}>
            <ResendVerificationForm email={email!} />
          </Suspense>

          <div className="pt-4">
            <Button variant="outline" className="w-full" asChild>
              <a href="/">Go to Homepage</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
