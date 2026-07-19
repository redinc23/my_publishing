import type { Metadata } from 'next';
import Link from 'next/link';
import { BookMarked, BookOpen, Clock } from 'lucide-react';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { isMissingEngagementTable } from '@/lib/reading/engagement';
import {
  ReadersHubTabs,
  type HubFollowedAuthor,
  type HubHighlight,
  type HubWishlistItem,
} from './ReadersHubTabs';

export const metadata: Metadata = {
  title: 'Readers Hub',
  description:
    'Manage reading activity, wishlists, and community features in the MANGU Readers Hub.',
};

export const dynamic = 'force-dynamic';

// ── Data loading (graceful: missing tables / errors → empty lists) ──────────

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadHighlights(userId: string): Promise<HubHighlight[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('highlights')
      .select('id, book_id, selected_text, position, color, note, created_at, book:books(id, title, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      if (!isMissingEngagementTable(error)) console.error('[readers-hub] highlights:', error);
      return [];
    }
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...(r as unknown as Omit<HubHighlight, 'book'>),
        book: normalizeOne(r.book as HubHighlight['book'] | HubHighlight['book'][] | null),
      };
    });
  } catch (error) {
    console.error('[readers-hub] highlights failed:', error);
    return [];
  }
}

async function loadWishlist(userId: string): Promise<HubWishlistItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('wishlist')
      .select(
        'id, book_id, created_at, book:books(id, title, slug, cover_url, price, discount_price, author:authors(id, pen_name))'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      if (!isMissingEngagementTable(error)) console.error('[readers-hub] wishlist:', error);
      return [];
    }
    type RawBook = Omit<NonNullable<HubWishlistItem['book']>, 'author'> & {
      author:
        | NonNullable<HubWishlistItem['book']>['author']
        | NonNullable<NonNullable<HubWishlistItem['book']>['author']>[]
        | null;
    };

    return (data ?? [])
      .map((row): HubWishlistItem => {
        const r = row as Record<string, unknown>;
        const rawBook = normalizeOne(r.book as RawBook | RawBook[] | null);
        const book = rawBook
          ? { ...rawBook, author: normalizeOne(rawBook.author) }
          : null;
        return {
          id: r.id as string,
          book_id: r.book_id as string,
          created_at: r.created_at as string,
          book,
        };
      })
      .filter((row) => row.book != null);
  } catch (error) {
    console.error('[readers-hub] wishlist failed:', error);
    return [];
  }
}

async function loadFollows(userId: string): Promise<HubFollowedAuthor[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('author_follows')
      .select('id, author_id, created_at, author:authors(id, pen_name, photo_url, bio, is_verified)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      if (!isMissingEngagementTable(error)) console.error('[readers-hub] follows:', error);
      return [];
    }
    return (data ?? [])
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          author_id: r.author_id as string,
          created_at: r.created_at as string,
          author: normalizeOne(
            r.author as HubFollowedAuthor['author'] | HubFollowedAuthor['author'][] | null
          ),
        };
      })
      .filter((row) => row.author != null);
  } catch (error) {
    console.error('[readers-hub] follows failed:', error);
    return [];
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

function QuickLinks() {
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            My Library
          </CardTitle>
          <CardDescription>View all your purchased and reading books</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/library">Open library</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Reading History
          </CardTitle>
          <CardDescription>Track your reading progress and history</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/books">Find books to read</Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            Discover
          </CardTitle>
          <CardDescription>Browse genres and save books to your wishlist</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/genres">Browse genres</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ReadersHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Section>
        <Container>
          <h1 className="mb-4 text-4xl font-bold">Readers Hub</h1>
          <Card className="mb-2">
            <CardHeader>
              <CardTitle>Your reading, all in one place</CardTitle>
              <CardDescription>
                Sign in to see your highlights, notes, wishlist, and the authors you follow.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register">Create account</Link>
              </Button>
            </CardContent>
          </Card>
          <QuickLinks />
        </Container>
      </Section>
    );
  }

  const [highlights, wishlist, follows] = await Promise.all([
    loadHighlights(user.id),
    loadWishlist(user.id),
    loadFollows(user.id),
  ]);

  return (
    <Section>
      <Container>
        <h1 className="mb-8 text-4xl font-bold">Readers Hub</h1>
        <ReadersHubTabs highlights={highlights} wishlist={wishlist} follows={follows} />
        <QuickLinks />
      </Container>
    </Section>
  );
}
