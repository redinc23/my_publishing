/* eslint-disable */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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

const sortOptions = [
  { value: 'published_at', label: 'Newest' },
  { value: 'total_reads', label: 'Most Popular' },
  { value: 'average_rating', label: 'Highest Rated' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'title', label: 'Title: A-Z' },
];

export function BookFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSearchParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset to first page
    router.push(`/books?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <Input
        placeholder="Search books..."
        defaultValue={searchParams?.get('q') || ''}
        onChange={(e) => {
          const value = e.target.value;
          const params = new URLSearchParams(searchParams?.toString() ?? '');
          if (value) {
            params.set('q', value);
          } else {
            params.delete('q');
          }
          params.delete('page');
          router.push(`/books?${params.toString()}`);
        }}
        className="flex-1"
      />
      <Select
        value={searchParams?.get('genre') || ''}
        onValueChange={(value) => updateSearchParam('genre', value)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Genres" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All Genres</SelectItem>
          {genres.map((genre) => (
            <SelectItem key={genre} value={genre}>
              {genre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams?.get('sort') || 'published_at'}
        onValueChange={(value) => updateSearchParam('sort', value)}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
