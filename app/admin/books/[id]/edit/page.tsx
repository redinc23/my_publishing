import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookEditForm } from './BookEditForm';
import { ArrowLeft } from 'lucide-react';

async function getBook(id: string) {
  const supabase = await createClient();
  const { data: book, error } = await supabase
    .from('books')
    .select('*, author:authors(*)')
    .eq('id', id)
    .single();
  if (error || !book) return null;
  return book;
}

export default async function EditBookPage({ params }: { params: { id: string } }) {
  const book = await getBook(params.id);
  if (!book) notFound();

  return (
    <Section>
      <Container>
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/books">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Books
            </Link>
          </Button>
        </div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Edit Book</h1>
          <p className="mt-2 text-muted-foreground">
            Editing &ldquo;{book.title}&rdquo; by {book.author?.pen_name || 'Unknown Author'}
          </p>
        </div>
        <div className="max-w-2xl">
          <BookEditForm book={book} />
        </div>
      </Container>
    </Section>
  );
}
