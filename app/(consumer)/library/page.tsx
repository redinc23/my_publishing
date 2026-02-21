import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { BookCard } from '@/components/cards/BookCard';
import type { BookWithAuthor } from '@/types';

interface OrderItem {
  id: string;
  unit_price: number;
  book: BookWithAuthor | null;
}

interface OrderWithItems {
  id: string;
  order_number: string;
  created_at: string;
  items: OrderItem[];
}

async function getLibraryItems() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data } = await supabase
    .from('orders')
    .select(
      'id, order_number, created_at, items:order_items(id, unit_price, book:books(*, author:authors!inner(*, profile:profiles!inner(*))))'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (data as OrderWithItems[]) || [];
}

export default async function LibraryPage() {
  const orders = await getLibraryItems();
  const purchasedItems = orders.flatMap((order) =>
    (order.items || [])
      .filter((item) => item.book)
      .map((item) => ({
        ...item,
        order,
      }))
  );

  return (
    <Section>
      <Container>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Your Library</h1>
            <p className="text-secondary mt-2">Access every book you've purchased.</p>
          </div>
        </div>

        {purchasedItems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-secondary">Your library is empty. Purchase a book to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {purchasedItems.map((item) => (
              <div key={item.id} className="space-y-3">
                <BookCard book={item.book!} />
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
