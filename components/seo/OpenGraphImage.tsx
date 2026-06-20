import React from 'react';

export interface OgImageConfig {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string;
}

export interface OpenGraphImageTagsProps {
  image: OgImageConfig | OgImageConfig[];
  siteName?: string;
  title?: string;
  description?: string;
  url?: string;
  type?: 'website' | 'article' | 'book';
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterCreator?: string;
  twitterSite?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  tags?: string[];
}

function normalizeImages(image: OgImageConfig | OgImageConfig[]): OgImageConfig[] {
  return Array.isArray(image) ? image : [image];
}

export function OpenGraphImageTags({
  image,
  siteName = 'MANGU Publishers',
  title,
  description,
  url,
  type = 'website',
  twitterCard = 'summary_large_image',
  twitterCreator = '@mangupublishers',
  twitterSite = '@mangupublishers',
  publishedTime,
  modifiedTime,
  authors,
  tags,
}: OpenGraphImageTagsProps) {
  const images = normalizeImages(image);

  return (
    <>
      {siteName && <meta property="og:site_name" content={siteName} />}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="en_US" />

      {images.map((img, index) => (
        <React.Fragment key={`og-image-${index}`}>
          <meta property="og:image" content={img.url} />
          {img.width && <meta property="og:image:width" content={String(img.width)} />}
          {img.height && <meta property="og:image:height" content={String(img.height)} />}
          {img.alt && <meta property="og:image:alt" content={img.alt} />}
          {img.type && <meta property="og:image:type" content={img.type} />}
        </React.Fragment>
      ))}

      <meta name="twitter:card" content={twitterCard} />
      {twitterSite && <meta name="twitter:site" content={twitterSite} />}
      {twitterCreator && <meta name="twitter:creator" content={twitterCreator} />}
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      {images[0]?.url && <meta name="twitter:image" content={images[0].url} />}
      {images[0]?.alt && <meta name="twitter:image:alt" content={images[0].alt} />}

      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' &&
        authors?.map((author, index) => (
          <meta key={`author-${index}`} property="article:author" content={author} />
        ))}
      {type === 'article' &&
        tags?.map((tag, index) => (
          <meta key={`tag-${index}`} property="article:tag" content={tag} />
        ))}
    </>
  );
}

export interface GenerateOgMetadataOptions {
  title: string;
  description: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

export function generateOgMetadata({
  title,
  description,
  path = '',
  image = '/og-image.png',
  imageAlt = 'MANGU Publishers - Your digital publishing platform',
  type = 'website',
  publishedTime,
  modifiedTime,
  authors,
}: GenerateOgMetadataOptions) {
  const baseUrl = 'https://manguprojectz.vercel.app';
  const fullUrl = path ? `${baseUrl}${path}` : baseUrl;
  const imageUrl = image.startsWith('http') ? image : `${baseUrl}${image}`;

  return {
    title,
    description,
    openGraph: {
      type,
      url: fullUrl,
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }],
      ...(type === 'article' && { publishedTime, modifiedTime, authors }),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [imageUrl],
      creator: '@mangupublishers',
    },
    alternates: { canonical: fullUrl },
  };
}

export function getDefaultOgConfig(overrides: Partial<GenerateOgMetadataOptions> = {}) {
  return generateOgMetadata({
    title: 'MANGU Publishers - Digital Publishing Platform',
    description:
      'Discover a universe of stories. Stream unlimited books, audiobooks, and exclusive videos anywhere, anytime.',
    ...overrides,
  });
}

export function getBookOgMetadata(
  bookTitle: string,
  authorName: string,
  description: string,
  slug: string,
  coverUrl?: string
) {
  return generateOgMetadata({
    title: `${bookTitle} by ${authorName} | MANGU Publishers`,
    description,
    path: `/books/${slug}`,
    image: coverUrl || '/og-image.png',
    imageAlt: `${bookTitle} - Book cover on MANGU Publishers`,
  });
}

export function getGenreOgMetadata(genre: string) {
  return generateOgMetadata({
    title: `${genre} Books | MANGU Publishers`,
    description: `Explore ${genre} books on MANGU Publishers. Discover new authors, bestsellers, and hidden gems in the ${genre} genre.`,
    path: `/genres/${encodeURIComponent(genre.toLowerCase())}`,
  });
}

export function getAuthorOgMetadata(authorName: string, bio?: string) {
  return generateOgMetadata({
    title: `${authorName} | MANGU Publishers Author`,
    description:
      bio ||
      `Discover books by ${authorName} on MANGU Publishers. Read their latest works and explore their complete collection.`,
    path: `/authors/${encodeURIComponent(authorName.toLowerCase())}`,
  });
}
