import Link from 'next/link';
import Image from 'next/image';
import { BookWithAuthor } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface BookCardProps {
  book: BookWithAuthor;
  variant?: 'default' | 'compact';
}

export function BookCard({ book, variant = 'default' }: BookCardProps) {
  if (variant === 'compact') {
    return (
      <Link href={`/books/${book.slug}`} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
          {book.cover_url && (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          )}
        </div>
        <div className="mt-2">
          <h3 className="line-clamp-1 font-semibold group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="text-sm text-secondary line-clamp-1">
            {book.author.profile.full_name || book.author.pen_name}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/books/${book.slug}`} className="group block">
      <Card className="overflow-hidden transition-transform duration-300 hover:scale-[1.02]">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          {book.cover_url && (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          )}
          {book.is_featured && (
            <Badge className="absolute top-2 right-2 bg-primary">Featured</Badge>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="line-clamp-1 font-semibold mb-1 group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="text-sm text-secondary line-clamp-1 mb-2">
            {book.author.profile.full_name || book.author.pen_name}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              <span className="text-sm">{book.average_rating.toFixed(1)}</span>
            </div>
            <div className="text-sm font-semibold">
              {book.discount_price ? (
                <>
                  <span className="text-secondary line-through mr-2">${book.price}</span>
                  <span className="text-primary">${book.discount_price}</span>
                </>
              ) : (
                <span>${book.price}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
