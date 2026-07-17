import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getPartnerForUser } from '@/lib/supabase/portal-queries';
import type { Database } from '@/types/database';

type Partner = Database['public']['Tables']['partners']['Row'];
type Book = Pick<
  Database['public']['Tables']['books']['Row'],
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'genre'
  | 'price'
  | 'discount_price'
  | 'status'
  | 'published_at'
  | 'cover_url'
> & { visibility?: string | null };

type BookRelation = Book | Book[] | null;

type ArcRequestRow = Database['public']['Tables']['arc_requests']['Row'] & {
  book: BookRelation;
};

type OrderItemRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'unit_price' | 'license_key' | 'created_at'
> & {
  book: BookRelation;
};

type OrderRow = Database['public']['Tables']['orders']['Row'] & {
  items: OrderItemRow[] | null;
};

export interface PartnerPortalData {
  partner: Partner | null;
  catalogBooks: Book[];
  arcRequests: ArcRequest[];
  orders: PartnerOrder[];
}

export type ArcRequest = Omit<ArcRequestRow, 'book'> & { book: Book | null };
export type PartnerOrder = Omit<OrderRow, 'items'> & { items: Array<Omit<OrderItemRow, 'book'> & { book: Book | null }> };

function normalizeBook(book: BookRelation): Book | null {
  if (!book) return null;
  return Array.isArray(book) ? (book[0] ?? null) : book;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);
}

export function titleCase(value: string | null | undefined) {
  if (!value) return 'Unknown';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function requirePartner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profile?.role !== 'partner' && profile?.role !== 'admin') {
    redirect('/');
  }

  const partner = await getPartnerForUser(user.id);
  return partner;
}

export async function getPartnerPortalData(): Promise<PartnerPortalData> {
  const partner = await requirePartner();

  if (!partner) {
    return { partner: null, catalogBooks: [], arcRequests: [], orders: [] };
  }

  const admin = createAdminClient();
  const [catalogResult, arcResult, orderResult] = await Promise.all([
    admin
      .from('books')
      .select(
        'id, title, slug, description, genre, price, discount_price, status, visibility, published_at, cover_url'
      )
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    admin
      .from('arc_requests')
      .select(
        'id, partner_id, book_id, quantity, status, requested_at, fulfilled_at, created_at, updated_at, book:books(id, title, slug, description, genre, price, discount_price, status, visibility, published_at, cover_url)'
      )
      .eq('partner_id', partner.id)
      .order('requested_at', { ascending: false }),
    admin
      .from('orders')
      .select(
        'id, order_number, user_id, total_amount, status, payment_intent_id, created_at, updated_at, items:order_items(id, unit_price, license_key, created_at, book:books(id, title, slug, description, genre, price, discount_price, status, visibility, published_at, cover_url))'
      )
      .eq('user_id', partner.profile_id)
      .order('created_at', { ascending: false }),
  ]);

  const arcRequests = ((arcResult.data as ArcRequestRow[] | null) ?? []).map((request) => ({
    ...request,
    book: normalizeBook(request.book),
  }));

  const orders = ((orderResult.data as OrderRow[] | null) ?? []).map((order) => ({
    ...order,
    items: (order.items ?? []).map((item) => ({ ...item, book: normalizeBook(item.book) })),
  }));

  return {
    partner,
    catalogBooks: (catalogResult.data as Book[] | null) ?? [],
    arcRequests,
    orders,
  };
}

export async function getPartnerOrder(orderId: string): Promise<{ partner: Partner | null; order: PartnerOrder | null }> {
  const partner = await requirePartner();

  if (!partner) {
    return { partner: null, order: null };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from('orders')
    .select(
      'id, order_number, user_id, total_amount, status, payment_intent_id, created_at, updated_at, items:order_items(id, unit_price, license_key, created_at, book:books(id, title, slug, description, genre, price, discount_price, status, visibility, published_at, cover_url))'
    )
    .eq('id', orderId)
    .eq('user_id', partner.profile_id)
    .single();

  if (!data) {
    return { partner, order: null };
  }

  const row = data as OrderRow;
  return {
    partner,
    order: {
      ...row,
      items: (row.items ?? []).map((item) => ({ ...item, book: normalizeBook(item.book) })),
    },
  };
}
