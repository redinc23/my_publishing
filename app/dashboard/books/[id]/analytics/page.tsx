// PERF-PHASE2-4
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// PERF-PHASE2-4 — Dynamic import: heavy client dashboard loaded as island
const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/AnalyticsDashboard'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    ),
  }
);

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
