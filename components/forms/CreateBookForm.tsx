'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateBookSchema } from '@/types/books';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createBook } from '@/lib/actions/books';
import type { CreateBookInput } from '@/types/books';

interface CreateBookFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateBookForm({ onSuccess, onCancel }: CreateBookFormProps) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBookInput>({
    resolver: zodResolver(CreateBookSchema),
    defaultValues: {
      language: 'en',
    },
  });

  const onSubmit = async (data: CreateBookInput) => {
    setSubmitting(true);
    try {
      const result = await createBook(data);
      if (result.success) {
        onSuccess?.();
      } else {
        alert(result.error || 'Failed to create book');
      }
    } catch (error) {
      alert('An error occurred while creating the book');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Enter book title"
            className="mt-1"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input
            id="subtitle"
            {...register('subtitle')}
            placeholder="Enter subtitle (optional)"
            className="mt-1"
          />
          {errors.subtitle && (
            <p className="mt-1 text-sm text-red-500">{errors.subtitle.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register('description')}
            placeholder="Enter book description"
            rows={6}
            className="mt-1"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="language">Language</Label>
          <Input
            id="language"
            {...register('language')}
            placeholder="en"
            className="mt-1"
          />
          {errors.language && (
            <p className="mt-1 text-sm text-red-500">{errors.language.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Book'}
        </Button>
      </div>
    </form>
  );
}
