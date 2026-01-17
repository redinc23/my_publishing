'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { submitManuscript } from './actions';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const manuscriptSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  workingTitle: z.string().optional(),
  genre: z.string().min(1, 'Genre is required'),
  synopsis: z.string().max(1000, 'Synopsis must be less than 1000 characters').optional(),
  wordCount: z.number().min(1, 'Word count is required').optional(),
  targetAudience: z.string().optional(),
});

type ManuscriptFormData = z.infer<typeof manuscriptSchema>;

const genres = [
  'Fiction',
  'Non-Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Romance',
  'Thriller',
  'Horror',
  'Biography',
  'History',
  'Self-Help',
  'Business',
];

export function SubmitManuscriptForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ManuscriptFormData>({
    resolver: zodResolver(manuscriptSchema),
  });

  const genre = watch('genre');

  const onSubmit = async (data: ManuscriptFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', data.title);
      if (data.workingTitle) formData.append('workingTitle', data.workingTitle);
      formData.append('genre', data.genre);
      if (data.synopsis) formData.append('synopsis', data.synopsis);
      if (data.wordCount) formData.append('wordCount', data.wordCount.toString());
      if (data.targetAudience) formData.append('targetAudience', data.targetAudience);

      const result = await submitManuscript(formData);

      if (result?.error) {
        setError(result.error);
      } else {
        router.push('/author/projects');
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500 p-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-2">
          Title <span className="text-red-500">*</span>
        </label>
        <Input id="title" {...register('title')} disabled={isLoading} />
        {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
      </div>

      <div>
        <label htmlFor="workingTitle" className="block text-sm font-medium mb-2">
          Working Title
        </label>
        <Input id="workingTitle" {...register('workingTitle')} disabled={isLoading} />
      </div>

      <div>
        <label htmlFor="genre" className="block text-sm font-medium mb-2">
          Genre <span className="text-red-500">*</span>
        </label>
        <Select value={genre} onValueChange={(value) => setValue('genre', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select genre" />
          </SelectTrigger>
          <SelectContent>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.genre && <p className="mt-1 text-sm text-red-500">{errors.genre.message}</p>}
      </div>

      <div>
        <label htmlFor="synopsis" className="block text-sm font-medium mb-2">
          Synopsis (max 1000 characters)
        </label>
        <textarea
          id="synopsis"
          {...register('synopsis')}
          className="flex min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        />
        {errors.synopsis && (
          <p className="mt-1 text-sm text-red-500">{errors.synopsis.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="wordCount" className="block text-sm font-medium mb-2">
          Word Count
        </label>
        <Input
          id="wordCount"
          type="number"
          {...register('wordCount', { valueAsNumber: true })}
          disabled={isLoading}
        />
        {errors.wordCount && (
          <p className="mt-1 text-sm text-red-500">{errors.wordCount.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="targetAudience" className="block text-sm font-medium mb-2">
          Target Audience
        </label>
        <Input id="targetAudience" {...register('targetAudience')} disabled={isLoading} />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? <LoadingSpinner size="sm" /> : 'Submit Manuscript'}
      </Button>
    </form>
  );
}
