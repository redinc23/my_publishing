interface WebPageJsonLdProps {
  url: string;
  title: string;
  description: string;
}

export function WebPageJsonLd({ url, title, description }: WebPageJsonLdProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
    name: title,
    description,
    publisher: {
      '@type': 'Organization',
      name: 'MANGU Publishers',
      url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
