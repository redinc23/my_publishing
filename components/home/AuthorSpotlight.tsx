import Link from 'next/link';
import Image from 'next/image';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { Container } from '@/components/layout/Container';
import { ChevronRight, Users } from 'lucide-react';
import { unstable_cache } from 'next/cache';

interface AuthorWithProfile {
  id: string;
  pen_name: string;
  bio: string | null;
  total_books: number;
  is_verified: boolean;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

async function getFeaturedAuthors(limit = 4): Promise<AuthorWithProfile[]> {
  try {
    const data = await unstable_cache(
      async (limit) => {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('authors')
          .select('id, pen_name, bio, total_books, is_verified, profile:profiles(full_name, avatar_url)')
          .order('total_books', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data as unknown as AuthorWithProfile[]) || [];
      },
      ['featured-authors'],
      { tags: ['featured-authors'], revalidate: 3600 }
    )(limit);
    return data;
  } catch (error) {
    console.error('Error fetching featured authors:', error);
    return [];
  }
}

export async function AuthorSpotlight() {
  const authors = await getFeaturedAuthors(4);

  if (authors.length === 0) {
    return (
      <section className="py-16 bg-background">
        <Container>
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Author Spotlight</h2>
            <p className="text-muted-foreground">Our authors will be featured here soon. Stay tuned!</p>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gradient-to-b from-muted/10 to-background">
      <Container>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-light tracking-tight mb-1">Author Spotlight</h2>
            <p className="text-sm text-muted-foreground">Meet the brilliant minds behind our stories</p>
          </div>
          <Link
            href="/authors"
            className="hidden sm:inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Meet Our Authors
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {authors.map((author) => (
            <Link key={author.id} href={`/authors/${author.id}`} className="group">
              <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
                {/* Avatar */}
                <div className="flex justify-center mb-4">
                  <div className="relative h-20 w-20 rounded-full overflow-hidden bg-primary/10 ring-2 ring-border group-hover:ring-primary/30 transition-all duration-300">
                    {author.profile?.avatar_url ? (
                      <Image
                        src={author.profile.avatar_url}
                        alt={author.pen_name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-2xl font-bold text-primary/60">
                        {author.pen_name[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                    {author.pen_name}
                  </h3>
                  {author.profile?.full_name && author.profile.full_name !== author.pen_name && (
                    <p className="text-sm text-muted-foreground mb-2">{author.profile.full_name}</p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {author.bio || 'An amazing author contributing to our platform.'}
                  </p>
                  <p className="text-xs font-medium text-primary/80">
                    {author.total_books} {author.total_books === 1 ? 'book' : 'books'} published
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile link */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/authors"
            className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Meet Our Authors
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
