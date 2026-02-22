'use client';

import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookCard } from '@/components/cards/BookCard';
import { getDiscoverBooks } from '@/lib/actions/books';
import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce'; // Assuming this hook exists, or I'll implement debounce manually

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Simple debounce
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    async function fetchBooks() {
      setLoading(true);
      try {
        const result = await getDiscoverBooks({ query: debouncedQuery });
        if (result.success && result.data) {
          setBooks(result.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchBooks();
  }, [debouncedQuery]);

  return (
    <Section>
      <Container>
        <div className="flex flex-col space-y-8">
            <div className="flex flex-col space-y-4">
                <h1 className="text-4xl font-bold">Discover</h1>
                <p className="text-muted-foreground text-lg">Find your next favorite book</p>

                <div className="relative max-w-xl">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, author, or keyword..."
                        className="pl-10 h-12"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                 <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin" />
                 </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {books.length > 0 ? (
                        books.map((book) => (
                            <BookCard
                                key={book.id}
                                book={{
                                    ...book,
                                    author: {
                                        pen_name: book.author_name || 'Unknown'
                                    }
                                }}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-10 text-muted-foreground">
                            No books found matching your search.
                        </div>
                    )}
                </div>
            )}
        </div>
      </Container>
    </Section>
  );
}
