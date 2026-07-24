import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/admin';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookEditForm } from './BookEditForm';
import { ArrowLeft } from 'lucide-react';

async function getBook(id: string) {
  const supabase = createClient();
  const { data: book, error } = await supabase
    .from('books')
    .select(
      'id, title, subtitle, description, slug, price, isbn, genre, page_count, word_count, status, content_type, amazon_url, kindle_url, apple_books_url, audible_url, barnes_noble_url, google_play_books_url, author:authors(pen_name)'
    )
    .eq('id', id)
    .single();
  if (error || !book) return null;
  return book;
}

export default async function EditBookPage({ params }: { params: { id: string } }) {
  const book = await getBook(params.id);
  if (!book) notFound();
  const { author, ...bookFormData } = book;
  const bookAuthor = Array.isArray(author) ? author[0] : author;

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
            Editing &ldquo;{book.title}&rdquo; by {bookAuthor?.pen_name || 'Unknown Author'}
          </p>
        </div>
        <div className="max-w-2xl">
          <BookEditForm book={bookFormData} />
        </div>
      </Container>
    </Section>
  );
}
