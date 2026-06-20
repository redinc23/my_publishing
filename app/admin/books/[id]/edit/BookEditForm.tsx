'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { updateBookAdmin } from '@/lib/actions/books';

interface BookEditFormProps {
  book: {
    id: string;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    slug: string;
    price?: number | null;
    isbn?: string | null;
    genre?: string | null;
    page_count?: number | null;
    word_count?: number | null;
    status: string;
    amazon_url?: string | null;
    kindle_url?: string | null;
    apple_books_url?: string | null;
    audible_url?: string | null;
    barnes_noble_url?: string | null;
    google_play_books_url?: string | null;
  };
}

export function BookEditForm({ book }: BookEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: book.title || '',
    subtitle: book.subtitle || '',
    description: book.description || '',
    slug: book.slug || '',
    price: book.price ?? '',
    isbn: book.isbn || '',
    genre: book.genre || '',
    page_count: book.page_count ?? '',
    word_count: book.word_count ?? '',
    status: book.status || 'draft',
    amazon_url: book.amazon_url || '',
    kindle_url: book.kindle_url || '',
    apple_books_url: book.apple_books_url || '',
    audible_url: book.audible_url || '',
    barnes_noble_url: book.barnes_noble_url || '',
    google_play_books_url: book.google_play_books_url || '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await updateBookAdmin(book.id, {
        title: formData.title,
        subtitle: formData.subtitle || undefined,
        description: formData.description || undefined,
        slug: formData.slug,
        price: formData.price !== '' ? Number(formData.price) : undefined,
        isbn: formData.isbn || undefined,
        genre: formData.genre || undefined,
        page_count: formData.page_count !== '' ? Number(formData.page_count) : undefined,
        word_count: formData.word_count !== '' ? Number(formData.word_count) : undefined,
        status: formData.status as 'draft' | 'published' | 'archived',
        amazon_url: formData.amazon_url || null,
        kindle_url: formData.kindle_url || null,
        apple_books_url: formData.apple_books_url || null,
        audible_url: formData.audible_url || null,
        barnes_noble_url: formData.barnes_noble_url || null,
        google_play_books_url: formData.google_play_books_url || null,
      });
      if (result.success) {
        router.push('/admin/books');
        router.refresh();
      } else {
        alert(result.error || 'Failed to update book');
      }
    } catch {
      alert('An error occurred while updating the book');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div><Label htmlFor="title">Title *</Label><Input id="title" name="title" value={formData.title} onChange={handleChange} required className="mt-1" /></div>
        <div><Label htmlFor="subtitle">Subtitle</Label><Input id="subtitle" name="subtitle" value={formData.subtitle} onChange={handleChange} className="mt-1" /></div>
        <div><Label htmlFor="slug">Slug *</Label><Input id="slug" name="slug" value={formData.slug} onChange={handleChange} required className="mt-1" /></div>
        <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={6} className="mt-1" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="price">Price ($)</Label><Input id="price" name="price" type="number" step="0.01" min="0" value={formData.price} onChange={handleChange} className="mt-1" /></div>
          <div><Label htmlFor="isbn">ISBN</Label><Input id="isbn" name="isbn" value={formData.isbn} onChange={handleChange} className="mt-1" /></div>
        </div>
        <div><Label htmlFor="genre">Genre</Label><Input id="genre" name="genre" value={formData.genre} onChange={handleChange} className="mt-1" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="page_count">Page Count</Label><Input id="page_count" name="page_count" type="number" min="0" value={formData.page_count} onChange={handleChange} className="mt-1" /></div>
          <div><Label htmlFor="word_count">Word Count</Label><Input id="word_count" name="word_count" type="number" min="0" value={formData.word_count} onChange={handleChange} className="mt-1" /></div>
        </div>
        <div><Label htmlFor="status">Status</Label>
          <select id="status" name="status" value={formData.status} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="pt-6 border-t border-border">
          <h3 className="text-lg font-semibold mb-2">External Retailer URLs</h3>
          <p className="text-sm text-muted-foreground mb-4">Add links to external retailers where this book is available. Leave blank to hide a button.</p>
          <div className="space-y-3">
            <div><Label htmlFor="amazon_url">Amazon URL</Label><Input id="amazon_url" name="amazon_url" type="url" value={formData.amazon_url} onChange={handleChange} placeholder="https://amazon.com/..." className="mt-1" /></div>
            <div><Label htmlFor="kindle_url">Kindle URL</Label><Input id="kindle_url" name="kindle_url" type="url" value={formData.kindle_url} onChange={handleChange} placeholder="https://amazon.com/kindle/..." className="mt-1" /></div>
            <div><Label htmlFor="apple_books_url">Apple Books URL</Label><Input id="apple_books_url" name="apple_books_url" type="url" value={formData.apple_books_url} onChange={handleChange} placeholder="https://books.apple.com/..." className="mt-1" /></div>
            <div><Label htmlFor="audible_url">Audible URL</Label><Input id="audible_url" name="audible_url" type="url" value={formData.audible_url} onChange={handleChange} placeholder="https://audible.com/..." className="mt-1" /></div>
            <div><Label htmlFor="barnes_noble_url">Barnes &amp; Noble URL</Label><Input id="barnes_noble_url" name="barnes_noble_url" type="url" value={formData.barnes_noble_url} onChange={handleChange} placeholder="https://barnesandnoble.com/..." className="mt-1" /></div>
            <div><Label htmlFor="google_play_books_url">Google Play Books URL</Label><Input id="google_play_books_url" name="google_play_books_url" type="url" value={formData.google_play_books_url} onChange={handleChange} placeholder="https://play.google.com/store/books/..." className="mt-1" /></div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/books')} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
      </div>
    </form>
  );
}
