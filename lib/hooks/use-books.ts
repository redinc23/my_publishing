'use client';

import useSWR from 'swr';
import type { BookWithAuthor } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useBooks(options?: { q?: string; genre?: string; sort?: string; page?: number }) {
  const params = new URLSearchParams();
  if (options?.q) params.append('q', options.q);
  if (options?.genre) params.append('genre', options.genre);
  if (options?.sort) params.append('sort', options.sort);
  if (options?.page) params.append('page', options.page.toString());

  const { data, error, isLoading, mutate } = useSWR<BookWithAuthor[]>(
    `/api/books?${params.toString()}`,
    fetcher
  );

  return {
    books: data || [],
    isLoading,
    error,
    mutate,
  };
}

export function useBook(slug: string) {
  const { data, error, isLoading, mutate } = useSWR<BookWithAuthor>(
    `/api/books/${slug}`,
    fetcher
  );

  return {
    book: data,
    isLoading,
    error,
    mutate,
  };
}

export function useFeaturedBooks() {
  const { data, error, isLoading } = useSWR<BookWithAuthor[]>('/api/books?featured=true', fetcher);

  return {
    books: data || [],
    isLoading,
    error,
  };
}

export function useTrendingBooks() {
  const { data, error, isLoading } = useSWR<BookWithAuthor[]>(
    '/api/books?sort=trending',
    fetcher
  );

  return {
    books: data || [],
    isLoading,
    error,
  };
}
