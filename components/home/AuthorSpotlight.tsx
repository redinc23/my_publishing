import Link from 'next/link';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getFeaturedAuthors } from '@/lib/supabase/queries';
import type { Author, Profile } from '@/types';

type AuthorWithProfile = Author & { profile: Profile };

export async function AuthorSpotlight() {
  const { data: authors } = await getFeaturedAuthors(4);
  const spotlightAuthors = (authors as AuthorWithProfile[] | null) ?? [];

  return (
    <section className="py-16 bg-background">
      <Container>
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-medium tracking-widest uppercase text-primary mb-2">
              Meet the Creators
            </p>
            <h2 className="text-3xl font-bold">Author Spotlight</h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex gap-1">
            <Link href="/books">
              Discover more <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {spotlightAuthors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Author spotlights coming soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {spotlightAuthors.map((author) => {
              const displayName =
                author.profile?.full_name || author.pen_name;
              const initial = displayName[0].toUpperCase();

              return (
                <div
                  key={author.id}
                  className="group p-5 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-bold text-primary">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{author.pen_name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {author.is_verified && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            <CheckCircle className="h-3 w-3 mr-1 inline" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {author.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {author.bio}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {author.total_books} {author.total_books === 1 ? 'book' : 'books'} published
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}

export function AuthorSpotlightSkeleton() {
  return (
    <section className="py-16 bg-background">
      <Container>
        <div className="flex items-end justify-between mb-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-44" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 rounded-xl border border-border">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-4/5 mb-3" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
