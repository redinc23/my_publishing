import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createPublicCatalogClient, PUBLIC_BOOK_SELECT } from '@/lib/supabase/public-queries';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
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

function normalizeBook(book: OrderItem['book']): BookWithAuthor | null {
  if (!book) return null;
  return Array.isArray(book) ? (book[0] ?? null) : book;
}

async function getLibraryItems() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Admin client so the nested author join resolves under RLS; safe because
  // results are filtered to the authenticated user's own orders.
  const adminClient = createPublicCatalogClient();

  // orders.user_id stores profiles.id (not the auth user id) — resolve it first.
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return [];
  }

  const { data } = await adminClient
    .from('orders')
    .select(
      `id, order_number, created_at, items:order_items(id, unit_price, book:books(${PUBLIC_BOOK_SELECT}))`
    )
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  return (data as OrderWithItems[]) || [];
}

export default async function LibraryPage() {
  const orders = await getLibraryItems();
  const purchasedItems = orders.flatMap((order) =>
    (order.items || []).reduce<Array<OrderItem & { book: BookWithAuthor; order: OrderWithItems }>>(
      (acc, item) => {
        const book = normalizeBook(item.book);
        if (!book) return acc;
        acc.push({ ...item, book, order });
        return acc;
      },
      []
    )
  );

  return (
    <Section>
      <Container>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Your Library</h1>
            <p className="mt-2 text-secondary">Access every book you&apos;ve purchased.</p>
          </div>
        </div>

        {purchasedItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-secondary">Your library is empty. Purchase a book to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {purchasedItems.map((item) => (
              <div key={item.id} className="space-y-3">
                <BookCard book={item.book} />
                <div className="text-sm text-secondary">
                  Order {item.order.order_number} •{' '}
                  {new Date(item.order.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
