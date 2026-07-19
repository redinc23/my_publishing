import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { EmailPreferences } from '@/components/email/EmailPreferences';

export const metadata: Metadata = {
  title: 'Account Settings',
  description: 'Manage your MANGU Publishers account and notification preferences.',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">Settings</h1>
      <p className="mb-8 text-secondary">Control how MANGU Publishers communicates with you.</p>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Email notifications</h2>
        <EmailPreferences />
      </section>
    </div>
  );
}
