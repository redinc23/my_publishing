import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  
  // Get all published books
  const { data: books } = await supabase
    .from('books')
    .select('id, slug, updated_at')
    .eq('status', 'published')
    .is('deleted_at', null);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mangu.com';

  const bookUrls = (books || []).map((book) => ({
    url: `${baseUrl}/books/${book.slug || book.id}`,
    lastModified: new Date(book.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/books`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...bookUrls,
  ];
}
