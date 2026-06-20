import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://manguprojectz.vercel.app';
  const supabase = createClient();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/books`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/discover`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${baseUrl}/discover/recommendations`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/discover/book-clubs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    { url: `${baseUrl}/genres`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/authors`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/audio`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/comics`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/papers`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    {
      url: `${baseUrl}/readers-hub`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];

  let bookRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: books, error } = await supabase
      .from('books')
      .select('id, slug, updated_at')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('updated_at', { ascending: false });
    if (!error && books) {
      bookRoutes = books.map((book) => ({
        url: `${baseUrl}/books/${book.slug || book.id}`,
        lastModified: new Date(book.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }
  } catch (e) {
    console.error('Sitemap: books fetch failed', e);
  }

  let genreRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: genres, error } = await supabase
      .from('books')
      .select('genre')
      .eq('status', 'published')
      .eq('visibility', 'public');
    if (!error && genres) {
      const uniqueGenres = [...new Set(genres.map((g) => g.genre).filter(Boolean))];
      genreRoutes = uniqueGenres.map((genre) => ({
        url: `${baseUrl}/genres/${encodeURIComponent(genre!.toLowerCase().replace(/\s+/g, '-'))}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.75,
      }));
    }
  } catch (e) {
    console.error('Sitemap: genres fetch failed', e);
  }

  let authorRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: authors, error } = await supabase
      .from('authors')
      .select('id, pen_name, updated_at')
      .order('updated_at', { ascending: false });
    if (!error && authors) {
      authorRoutes = authors.map((author) => ({
        url: `${baseUrl}/authors/${author.id}`,
        lastModified: new Date(author.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error('Sitemap: authors fetch failed', e);
  }

  return [...staticRoutes, ...bookRoutes, ...genreRoutes, ...authorRoutes];
}
