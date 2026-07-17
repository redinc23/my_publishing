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
export type PartnerOrder = Omit<OrderRow, 'items'> & {
  items: Array<Omit<OrderItemRow, 'book'> & { book: Book | null }>;
};

export class PartnerDataUnavailableError extends Error {
  constructor(message = 'Partner portal data is temporarily unavailable.') {
    super(message);
    this.name = 'PartnerDataUnavailableError';
  }
}

/** Normalize ARC filter aliases so UI labels map to DB status values. */
export function normalizeArcStatusFilter(status: string | undefined | null): string {
  const value = status ?? 'all';
  if (value === 'denied') return 'rejected';
  return value;
}

/** Clamp a 1-based page index into [1, totalPages] before slicing. */
export function clampPage(page: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(Math.floor(page), safeTotal);
}

function normalizeBook(book: BookRelation): Book | null {
  if (!book) return null;
  return Array.isArray(book) ? (book[0] ?? null) : book;
}

function assertQueryOk(result: { error: { message?: string } | null }, label: string) {
  if (result.error) {
    console.error(`[partner-data] ${label} failed:`, result.error);
    throw new PartnerDataUnavailableError(
      `Unable to load ${label}. Please try again shortly.`
    );
  }
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

  assertQueryOk(catalogResult, 'catalog');
  assertQueryOk(arcResult, 'ARC requests');
  assertQueryOk(orderResult, 'orders');

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

export async function getPartnerOrder(
  orderId: string
): Promise<{ partner: Partner | null; order: PartnerOrder | null }> {
  const partner = await requirePartner();

  if (!partner) {
    return { partner: null, order: null };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('orders')
    .select(
      'id, order_number, user_id, total_amount, status, payment_intent_id, created_at, updated_at, items:order_items(id, unit_price, license_key, created_at, book:books(id, title, slug, description, genre, price, discount_price, status, visibility, published_at, cover_url))'
    )
    .eq('id', orderId)
    .eq('user_id', partner.profile_id)
    .single();

  if (error) {
    // PGRST116 = no rows — genuine 404, not an infrastructure failure
    if (error.code === 'PGRST116') {
      return { partner, order: null };
    }
    console.error('[partner-data] order detail failed:', error);
    throw new PartnerDataUnavailableError('Unable to load this order. Please try again shortly.');
  }

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
