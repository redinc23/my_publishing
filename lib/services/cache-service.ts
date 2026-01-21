
'use server';

import { createClient } from '@/lib/supabase/server';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('cache')
      .select('value, expires_at')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    return JSON.parse(data.value) as T;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setCache(key: string, value: any, ttl?: number): Promise<void> {
  const expires = new Date(Date.now() + (ttl || DEFAULT_TTL));

  try {
    const supabase = await createClient();
    await supabase
      .from('cache')
      .upsert({
        key,
        value: JSON.stringify(value),
        expires_at: expires.toISOString(),
        updated_at: new Date().toISOString(),
      });
  } catch (error) {
    console.warn('Failed to set cache:', error);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase
      .from('cache')
      .delete()
      .like('key', `%${pattern}%`);
  } catch (error) {
    console.warn('Failed to invalidate cache:', error);
  }
}