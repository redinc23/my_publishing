import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

interface AnalyticsPageProps {
  params: {
    id: string;
  };
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Verify book ownership
  const { data: book } = await supabase
    .from('books')
    .select('id, title, author_id')
    .eq('id', params.id)
    .single();

  if (!book || book.author_id !== user.id) {
    redirect('/dashboard');
  }

  return <AnalyticsDashboard bookId={params.id} />;
}