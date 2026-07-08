'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createBookAdmin } from '@/lib/actions/books';

interface BookCreateFormProps {
  authors: Array<{ id: string; pen_name: string }>;
}

const NO_AUTHOR = 'none';

export function BookCreateForm({ authors }: BookCreateFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    genre: '',
    price: '',
    status: 'draft',
    content_type: 'book',
    author_id: NO_AUTHOR,
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
    setError(null);
    try {
      const result = await createBookAdmin({
        title: formData.title,
        slug: formData.slug || undefined,
        description: formData.description || undefined,
        genre: formData.genre,
        price: formData.price !== '' ? Number(formData.price) : undefined,
        status: formData.status as 'draft' | 'published',
        content_type: formData.content_type as 'book' | 'comic' | 'paper',
        author_id: formData.author_id === NO_AUTHOR ? null : formData.author_id,
      });
      if (result.success) {
        router.push('/admin/books');
        router.refresh();
      } else {
        setError(result.error || 'Failed to create book');
      }
    } catch {
      setError('An error occurred while creating the book');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Create book form">
      {error && (
        <div role="alert" className="rounded-md bg-red-500/10 border border-red-500 p-3 text-sm text-red-500">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div><Label htmlFor="title">Title *</Label><Input id="title" name="title" value={formData.title} onChange={handleChange} required className="mt-1" /></div>
        <div><Label htmlFor="slug">Slug</Label><Input id="slug" name="slug" value={formData.slug} onChange={handleChange} placeholder="auto-generated from title if left blank" className="mt-1" /></div>
        <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={6} className="mt-1" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label htmlFor="genre">Genre *</Label><Input id="genre" name="genre" value={formData.genre} onChange={handleChange} required className="mt-1" /></div>
          <div><Label htmlFor="price">Price ($)</Label><Input id="price" name="price" type="number" step="0.01" min="0" value={formData.price} onChange={handleChange} className="mt-1" /></div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="author_id">Author</Label>
          <Select
            value={formData.author_id}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, author_id: value }))}
          >
            <SelectTrigger id="author_id">
              <SelectValue placeholder="Select an author" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_AUTHOR}>No author (assign later)</SelectItem>
              {authors.map((author) => (
                <SelectItem key={author.id} value={author.id}>{author.pen_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="status">Status</Label>
          <select id="status" name="status" value={formData.status} onChange={handleChange} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="content_type">Content Type</Label>
          <Select
            value={formData.content_type}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, content_type: value }))}
          >
            <SelectTrigger id="content_type">
              <SelectValue placeholder="Select content type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="book">Book</SelectItem>
              <SelectItem value="comic">Comic Book</SelectItem>
              <SelectItem value="paper">Paper / Article</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/books')} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Book'}</Button>
      </div>
    </form>
  );
}
