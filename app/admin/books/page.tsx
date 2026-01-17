import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function AdminBooksPage() {
  const supabase = await createClient();

  const { data: books } = await supabase
    .from('books')
    .select('*, author:authors(*)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <Section>
      <Container>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Books Management</h1>
          <Button asChild>
            <Link href="/admin/books/new">Add New Book</Link>
          </Button>
        </div>

        <div className="space-y-4">
          {books && books.length > 0 ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Author</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Price</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book: any) => (
                    <tr key={book.id} className="border-t border-border">
                      <td className="px-4 py-3">{book.title}</td>
                      <td className="px-4 py-3">{book.author?.pen_name || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            book.status === 'published'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-gray-500/20 text-gray-500'
                          }`}
                        >
                          {book.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">${book.price}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/books/${book.id}/edit`}>Edit</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary">No books found</p>
          )}
        </div>
      </Container>
    </Section>
  );
}
