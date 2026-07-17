import { MetadataRoute } from 'next';
import { createPublicCatalogClient } from '@/lib/supabase/public-queries';
import { getSiteUrl } from '@/lib/seo/siteUrl';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const supabase = createPublicCatalogClient();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/books`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/comics`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/papers`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/audio`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.75 },
    { url: `${baseUrl}/authors`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    {
      url: `${baseUrl}/discover`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/recommendations`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/discover/recommendations`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/book-clubs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/discover/book-clubs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/genres`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${baseUrl}/readers-hub`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.35,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.65,
    },
    {
      url: `${baseUrl}/faqs`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.45,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.55,
    },
    {
      url: `${baseUrl}/press`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.45,
    },
  ];

  const bookRoutes: MetadataRoute.Sitemap = [];
  let genreRoutes: MetadataRoute.Sitemap = [];
  try {
    const uniqueGenres = new Set<string>();
    const pageSize = 500;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: books, error } = await supabase
        .from('books')
        .select('id, slug, genre, updated_at')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .order('updated_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error || !books) {
        break;
      }

      for (const book of books) {
        bookRoutes.push({
          url: `${baseUrl}/books/${book.slug || book.id}`,
          lastModified: new Date(book.updated_at),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        });

        const genre = book.genre?.trim();
        if (genre) uniqueGenres.add(genre);
      }

      hasMore = books.length === pageSize;
      from += pageSize;
    }

    genreRoutes = Array.from(uniqueGenres).map((genre) => ({
      url: `${baseUrl}/genres/${encodeURIComponent(genre)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    }));
  } catch (e) {
    console.error('Sitemap: books fetch failed', e);
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
