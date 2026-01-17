'use client';

import useSWR from 'swr';
import type { ResonanceResponse } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useRecommendations(userId?: string, limit: number = 10) {
  const { data, error, isLoading } = useSWR<ResonanceResponse>(
    userId ? `/api/resonance/recommend?user_id=${userId}&limit=${limit}` : null,
    fetcher
  );

  return {
    recommendations: data?.data || [],
    isLoading,
    error,
  };
}
