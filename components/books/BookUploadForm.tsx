'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateBookSchema } from '@/types/books';
import { FileUpload } from '@/components/ui/file-upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { uploadFile } from '@/lib/actions/upload';
import { createBook } from '@/lib/actions/books';
import type { CreateBookInput } from '@/types/books';

interface BookUploadFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BookUploadForm({ onSuccess, onCancel }: BookUploadFormProps) {
  const [uploading, setUploading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [epubUrl, setEpubUrl] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBookInput>({
    resolver: zodResolver(CreateBookSchema),
    defaultValues: {
      genre: '',
    },
  });

  const handleCoverUpload = async (file: File) => {
    const result = await uploadFile(file, 'book-covers');
    setCoverUrl(result.publicUrl);
    return result.publicUrl;
  };

  const handleEpubUpload = async (file: File) => {
    const result = await uploadFile(file, 'published-epubs');
    setEpubUrl(result.publicUrl);
    return result.publicUrl;
  };

  const onSubmit = async (data: CreateBookInput) => {
    setUploading(true);
    try {
      const result = await createBook({
        ...data,
        cover_url: coverUrl,
        epub_url: epubUrl,
      });

      if (result.success) {
        onSuccess?.();
      } else {
        alert(result.error || 'Failed to create book');
      }
    } catch (error) {
      alert('An error occurred while creating the book');
    } finally {
      setUploading(false);
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
          <Label htmlFor="genre">Genre *</Label>
          <Input
            id="genre"
            {...register('genre')}
            placeholder="Enter genre"
            className="mt-1"
          />
          {errors.genre && (
            <p className="mt-1 text-sm text-red-500">{errors.genre.message}</p>
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
          <Label>Cover Image</Label>
          <FileUpload
            onUpload={handleCoverUpload}
            accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
            maxSize={10 * 1024 * 1024}
            className="mt-1"
          />
        </div>

        <div>
          <Label>EPUB File</Label>
          <FileUpload
            onUpload={handleEpubUpload}
            accept={{ 'application/epub+zip': ['.epub'] }}
            maxSize={50 * 1024 * 1024}
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={uploading}>
          {uploading ? 'Creating...' : 'Create Book'}
        </Button>
      </div>
    </form>
  );
}
