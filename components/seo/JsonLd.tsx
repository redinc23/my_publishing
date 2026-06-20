/**
 * JSON-LD Structured Data Components
 * @see https://schema.org/docs/schemas.html
 * @see https://developers.google.com/search/docs/appearance/structured-data
 */

interface JsonLdProps {
  data: Record<string, unknown>;
  id?: string;
}

interface BookAuthor {
  name: string;
  url?: string;
}

interface BookReview {
  author: string;
  rating: number;
  reviewBody?: string;
  datePublished?: string;
}

interface BreadcrumbItem {
  name: string;
  item: string;
}

function JsonLdScript({ data, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

interface OrganizationJsonLdProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  email?: string;
}

export function OrganizationJsonLd({
  name = 'MANGU Publishers',
  url = 'https://manguprojectz.vercel.app',
  logo = 'https://manguprojectz.vercel.app/logo.png',
  description = 'Discover a universe of stories. Stream unlimited books, audiobooks, and exclusive videos anywhere, anytime.',
  sameAs = [
    'https://twitter.com/mangupublishers',
    'https://facebook.com/mangupublishers',
    'https://instagram.com/mangupublishers',
  ],
  email = 'contact@manguprojectz.vercel.app',
}: OrganizationJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
    description,
    sameAs,
    email,
    logo: { '@type': 'ImageObject', url: logo, width: 512, height: 512 },
    foundingDate: '2024',
    address: { '@type': 'PostalAddress', addressCountry: 'US' },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email,
      availableLanguage: ['English'],
    },
  };
  return <JsonLdScript data={data} id="organization-jsonld" />;
}

interface WebSiteJsonLdProps {
  name?: string;
  url?: string;
  description?: string;
  searchUrl?: string;
}

export function WebSiteJsonLd({
  name = 'MANGU Publishers',
  url = 'https://manguprojectz.vercel.app',
  description = 'Discover, read, and publish books on the MANGU platform',
  searchUrl = 'https://manguprojectz.vercel.app/books?search={search_term_string}',
}: WebSiteJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    description,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: searchUrl },
      'query-input': 'required name=search_term_string',
    },
  };
  return <JsonLdScript data={data} id="website-jsonld" />;
}

interface WebPageJsonLdProps {
  title?: string;
  description?: string;
  url?: string;
  siteName?: string;
  type?: 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage' | 'SearchResultsPage';
  datePublished?: string;
  dateModified?: string;
  image?: string;
  breadcrumb?: BreadcrumbItem[];
}

export function WebPageJsonLd({
  title = 'MANGU Publishers - Digital Publishing Platform',
  description = 'Discover a universe of stories. Stream unlimited books, audiobooks, and exclusive videos anywhere, anytime.',
  url = 'https://manguprojectz.vercel.app',
  siteName = 'MANGU Publishers',
  type = 'WebPage',
  datePublished = '2024-01-01T00:00:00+00:00',
  dateModified = new Date().toISOString(),
  image = 'https://manguprojectz.vercel.app/og-image.png',
  breadcrumb,
}: WebPageJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': type,
    name: title,
    headline: title,
    description,
    url,
    image: { '@type': 'ImageObject', url: image, width: 1200, height: 630 },
    datePublished,
    dateModified,
    publisher: {
      '@type': 'Organization',
      name: siteName,
      logo: {
        '@type': 'ImageObject',
        url: 'https://manguprojectz.vercel.app/logo.png',
        width: 512,
        height: 512,
      },
    },
    inLanguage: 'en-US',
    isPartOf: { '@type': 'WebSite', name: siteName, url: 'https://manguprojectz.vercel.app' },
  };

  if (breadcrumb && breadcrumb.length > 0) {
    data.breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumb.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.item,
      })),
    };
  }

  return <JsonLdScript data={data} id="webpage-jsonld" />;
}

interface BookJsonLdProps {
  title: string;
  author: BookAuthor | BookAuthor[];
  description?: string;
  url: string;
  coverUrl?: string;
  isbn?: string;
  language?: string;
  numberOfPages?: number;
  datePublished?: string;
  dateModified?: string;
  genre?: string | string[];
  rating?: { value: number; count: number };
  reviews?: BookReview[];
  publisher?: string;
  keywords?: string[];
  price?: { amount: number; currency: string };
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
}

export function BookJsonLd({
  title,
  author,
  description,
  url,
  coverUrl,
  isbn,
  language = 'en',
  numberOfPages,
  datePublished,
  dateModified,
  genre,
  rating,
  reviews,
  publisher = 'MANGU Publishers',
  keywords,
  price,
  availability = 'InStock',
}: BookJsonLdProps) {
  const authors = Array.isArray(author) ? author : [author];

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: title,
    headline: title,
    url,
    inLanguage: language,
    publisher: { '@type': 'Organization', name: publisher },
    author: authors.map((a) => ({ '@type': 'Person', name: a.name, url: a.url })),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  if (description) data.description = description;
  if (coverUrl) {
    data.image = { '@type': 'ImageObject', url: coverUrl };
    data.thumbnailUrl = coverUrl;
  }
  if (isbn) data.isbn = isbn;
  if (numberOfPages) data.numberOfPages = numberOfPages;
  if (datePublished) data.datePublished = datePublished;
  if (dateModified) data.dateModified = dateModified;
  if (genre) data.genre = genre;
  if (keywords?.length) data.keywords = keywords.join(', ');

  if (rating) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.value,
      bestRating: 5,
      worstRating: 1,
      ratingCount: rating.count,
    };
  }

  if (reviews?.length) {
    data.review = reviews.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      ...(r.reviewBody && { reviewBody: r.reviewBody }),
      ...(r.datePublished && { datePublished: r.datePublished }),
    }));
  }

  if (price) {
    data.offers = {
      '@type': 'Offer',
      price: price.amount,
      priceCurrency: price.currency,
      availability: `https://schema.org/${availability}`,
      url,
      seller: { '@type': 'Organization', name: publisher },
    };
  }

  return <JsonLdScript data={data} id="book-jsonld" />;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
  return <JsonLdScript data={data} id="breadcrumb-jsonld" />;
}

interface ArticleJsonLdProps {
  title: string;
  description?: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: { name: string; url?: string };
  publisher?: string;
  publisherLogo?: string;
}

export function ArticleJsonLd({
  title,
  description,
  url,
  image,
  datePublished,
  dateModified,
  author,
  publisher = 'MANGU Publishers',
  publisherLogo = 'https://manguprojectz.vercel.app/logo.png',
}: ArticleJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    url,
    datePublished,
    author: {
      '@type': author.url ? 'Person' : 'Organization',
      name: author.name,
      ...(author.url && { url: author.url }),
    },
    publisher: {
      '@type': 'Organization',
      name: publisher,
      logo: { '@type': 'ImageObject', url: publisherLogo },
    },
  };

  if (description) data.description = description;
  if (dateModified) data.dateModified = dateModified;
  if (image) data.image = { '@type': 'ImageObject', url: image, width: 1200, height: 630 };

  return <JsonLdScript data={data} id="article-jsonld" />;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqPageJsonLdProps {
  faqs: FaqItem[];
}

export function FaqPageJsonLd({ faqs }: FaqPageJsonLdProps) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
  return <JsonLdScript data={data} id="faqpage-jsonld" />;
}

interface SoftwareAppJsonLdProps {
  name?: string;
  description?: string;
  url?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  rating?: { value: number; count: number };
  price?: { amount: number; currency: string };
}

export function SoftwareAppJsonLd({
  name = 'MANGU Publishers',
  description = 'Discover a universe of stories. Stream unlimited books, audiobooks, and exclusive videos anywhere, anytime.',
  url = 'https://manguprojectz.vercel.app',
  applicationCategory = 'Books & ReferenceApplication',
  operatingSystem = 'Any',
  rating,
  price,
}: SoftwareAppJsonLdProps) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    url,
    applicationCategory,
    operatingSystem,
    offers: price
      ? { '@type': 'Offer', price: price.amount, priceCurrency: price.currency }
      : { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
  };

  if (rating) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.value,
      ratingCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return <JsonLdScript data={data} id="softwareapp-jsonld" />;
}
