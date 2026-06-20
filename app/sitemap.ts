import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/admin';

function hasGenre(genre: string | null): genre is string {
  return Boolean(genre);
}

function getGenreSlug(genre: string): string {
  return encodeURIComponent(genre.toLowerCase().replace(/\s+/g, '-'));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://manguprojectz.vercel.app';
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/books`, lastModified, changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/discover`, lastModified, changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${baseUrl}/discover/recommendations`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/discover/book-clubs`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    { url: `${baseUrl}/genres`, lastModified, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/authors`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/audio`, lastModified, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/comics`, lastModified, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/papers`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    {
      url: `${baseUrl}/readers-hub`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    { url: `${baseUrl}/about`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
  ];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return staticRoutes;
  }

  const supabase = createClient();

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
  } catch (error) {
    console.error('Sitemap: books fetch failed', error);
  }

  let genreRoutes: MetadataRoute.Sitemap = [];
  try {
    const { data: genres, error } = await supabase
      .from('books')
      .select('genre')
      .eq('status', 'published')
      .eq('visibility', 'public');
    if (!error && genres) {
      const uniqueGenres = [...new Set(genres.map((genre) => genre.genre).filter(hasGenre))];
      genreRoutes = uniqueGenres.map((genre) => ({
        url: `${baseUrl}/genres/${getGenreSlug(genre)}`,
        lastModified,
        changeFrequency: 'weekly' as const,
        priority: 0.75,
      }));
    }
  } catch (error) {
    console.error('Sitemap: genres fetch failed', error);
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
  } catch (error) {
    console.error('Sitemap: authors fetch failed', error);
  }

  return [...staticRoutes, ...bookRoutes, ...genreRoutes, ...authorRoutes];
}
