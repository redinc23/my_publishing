import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { LibraryExperience } from '@/components/library/LibraryExperience';
import { LibraryError } from '@/components/library/LibraryError';
import type { LibraryItem } from '@/components/library/types';
import type { BookWithAuthor } from '@/types';

interface OrderItem {
  id: string;
  unit_price: number;
  book: BookWithAuthor | BookWithAuthor[] | null;
}

interface OrderWithItems {
  id: string;
  order_number: string;
  created_at: string;
  items: OrderItem[];
}

interface ReadingProgressRow {
  book_id: string;
  current_position: number;
  is_finished: boolean;
  last_accessed?: string | null;
}

interface LibraryData {
  orders: OrderWithItems[];
  progress: ReadingProgressRow[];
}

function normalizeBook(book: OrderItem['book']): BookWithAuthor | null {
  if (!book) return null;
  return Array.isArray(book) ? (book[0] ?? null) : book;
}

async function getLibraryData(): Promise<LibraryData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Admin client so the nested author join resolves under RLS; safe because
  // results are filtered to the authenticated user's own completed orders.
  const adminClient = createPublicCatalogClient();

  // orders.user_id stores profiles.id (not the auth user id) — resolve it first.
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to load library profile: ${profileError.message}`);
  }

  if (!profile) {
    return { orders: [], progress: [] };
  }

  const { data, error: ordersError } = await adminClient
    .from('orders')
    .select(
      `id, order_number, created_at, items:order_items(id, unit_price, book:books(${PUBLIC_BOOK_SELECT}))`
    )
    .eq('user_id', profile.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (ordersError) {
    throw new Error(`Failed to load library orders: ${ordersError.message}`);
  }

  // Reading progress is an enhancement, not a gate: on failure, log it and
  // degrade gracefully to zero progress rows rather than failing the page.
  const { data: progressRows, error: progressError } = await adminClient
    .from('reading_progress')
    .select('book_id, current_position, is_finished, last_accessed')
    .eq('user_id', profile.id);

  if (progressError) {
    console.error(`Failed to load reading progress: ${progressError.message}`);
  }

  return {
    orders: (data as OrderWithItems[]) || [],
    progress: progressError ? [] : (progressRows as ReadingProgressRow[]) || [],
  };
}

function buildLibraryItems({ orders, progress }: LibraryData): LibraryItem[] {
  const progressByBookId = new Map<string, ReadingProgressRow>();
  for (const row of progress) {
    progressByBookId.set(row.book_id, row);
  }

  return orders.flatMap((order) =>
    (order.items || []).reduce<LibraryItem[]>((acc, item) => {
      const book = normalizeBook(item.book);
      if (!book) return acc;
      const progressRow = progressByBookId.get(book.id);
      acc.push({
        book,
        orderNumber: order.order_number,
        purchasedAt: order.created_at,
        ...(progressRow
          ? {
              progress: {
                currentPosition: progressRow.current_position,
                isFinished: progressRow.is_finished,
                ...(progressRow.last_accessed ? { lastAccessed: progressRow.last_accessed } : {}),
              },
            }
          : {}),
      });
      return acc;
    }, [])
  );
}

export default async function LibraryPage() {
  let libraryData: LibraryData;
  try {
    libraryData = await getLibraryData();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string' &&
      (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Failed to load your library.';
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f5f1ea]">
        <h1 className="sr-only">Your Library</h1>
        <LibraryError message={message} />
      </div>
    );
  }

  const items = buildLibraryItems(libraryData);

  return <LibraryExperience items={items} />;
}
