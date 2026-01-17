import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface GenreCardProps {
  genre: string;
  bookCount?: number;
  className?: string;
}

export function GenreCard({ genre, bookCount, className }: GenreCardProps) {
  return (
    <Link href={`/genres/${genre.toLowerCase()}`}>
      <Card className={cn('transition-transform duration-300 hover:scale-[1.02]', className)}>
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold mb-2 capitalize">{genre}</h3>
          {bookCount !== undefined && (
            <p className="text-sm text-secondary">{bookCount} books</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
