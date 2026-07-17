/* eslint-disable */
import Link from 'next/link';
import Image from 'next/image';
import { Author, Profile } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AuthorCardProps {
  author: Author & { profile: Profile | null };
}

export function AuthorCard({ author }: AuthorCardProps) {
  return (
    <Link href={`/authors/${author.id}`}>
      <Card className="transition-transform duration-300 hover:scale-[1.02]">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold">
              {(author.profile?.full_name || author.pen_name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="mb-1 font-semibold">{author.pen_name}</h3>
              {author.is_verified && (
                <Badge variant="secondary" className="text-xs">
                  Verified
                </Badge>
              )}
              <p className="mt-2 line-clamp-2 text-sm text-secondary">{author.bio}</p>
              <p className="mt-2 text-xs text-secondary">{author.total_books} books</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
