import { createClient } from '@/lib/supabase/admin';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BookCreateForm } from './BookCreateForm';

export const dynamic = 'force-dynamic';

async function getAuthors() {
  // Admin client: the authors table has RLS enabled with no public SELECT
  // policy; access to this page is already gated by the admin layout.
  const supabase = createClient();
  const { data } = await supabase
    .from('authors')
    .select('id, pen_name')
    .order('pen_name', { ascending: true });
  return data ?? [];
}

export default async function NewBookPage() {
  const authors = await getAuthors();

  return (
    <Section>
      <Container>
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/books"><ArrowLeft className="mr-2 h-4 w-4" />Back to Books</Link>
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Add New Book</h1>
          <p className="text-muted-foreground mt-2">
            Create a book record. You can edit details and retailer links after saving.
          </p>
        </div>
        <div className="max-w-2xl"><BookCreateForm authors={authors} /></div>
      </Container>
    </Section>
  );
}
