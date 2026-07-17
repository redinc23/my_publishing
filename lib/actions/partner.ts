'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getPartnerForUser } from '@/lib/supabase/portal-queries';

async function requirePartnerAction() {
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

  if (profile?.role !== 'partner') {
    throw new Error('Only partner accounts can perform partner portal actions.');
  }

  const partner = await getPartnerForUser(user.id);

  if (!partner) {
    throw new Error('Partner profile not found.');
  }

  return partner;
}

export async function createArcRequest(formData: FormData) {
  const partner = await requirePartnerAction();
  const bookId = String(formData.get('bookId') ?? '');
  const quantity = Math.max(1, Math.min(500, Number(formData.get('quantity') ?? 1) || 1));

  if (!bookId) {
    throw new Error('A catalog book is required.');
  }

  const admin = createAdminClient();
  const { data: book } = await admin
    .from('books')
    .select('id')
    .eq('id', bookId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .single();

  if (!book) {
    throw new Error('Catalog book not found.');
  }

  const { error } = await admin.from('arc_requests').insert({
    partner_id: partner.id,
    book_id: bookId,
    quantity,
    status: 'pending',
  });

  if (error) {
    throw new Error(`Unable to create ARC request: ${error.message}`);
  }

  revalidatePath('/partner/dashboard');
  revalidatePath('/partner/catalogs');
  revalidatePath('/partner/arc-requests');
  redirect('/partner/arc-requests?status=pending');
}

export async function reorderPartnerOrder(formData: FormData) {
  const partner = await requirePartnerAction();
  const orderId = String(formData.get('orderId') ?? '');

  if (!orderId) {
    throw new Error('An order is required.');
  }

  const admin = createAdminClient();
  const { data: sourceOrder } = await admin
    .from('orders')
    .select('id, user_id, items:order_items(book_id, unit_price, license_key)')
    .eq('id', orderId)
    .eq('user_id', partner.profile_id)
    .single();

  if (!sourceOrder || !sourceOrder.items?.length) {
    throw new Error('Order not found for this partner account.');
  }

  const totalAmount = sourceOrder.items.reduce((sum, item) => sum + Number(item.unit_price ?? 0), 0);
  const orderNumber = `PARTNER-REORDER-${Date.now()}`;
  const { data: newOrder, error: orderError } = await admin
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: partner.profile_id,
      total_amount: totalAmount,
      status: 'pending',
    })
    .select('id')
    .single();

  if (orderError || !newOrder) {
    throw new Error(`Unable to create reorder: ${orderError?.message ?? 'unknown error'}`);
  }

  const { error: itemError } = await admin.from('order_items').insert(
    sourceOrder.items.map((item) => ({
      order_id: newOrder.id,
      book_id: item.book_id,
      unit_price: Number(item.unit_price ?? 0),
      license_key: item.license_key ? `REORDER-${item.license_key}` : null,
    }))
  );

  if (itemError) {
    await admin.from('orders').delete().eq('id', newOrder.id);
    throw new Error(`Unable to copy order items: ${itemError.message}`);
  }

  revalidatePath('/partner/dashboard');
  revalidatePath('/partner/orders');
  redirect(`/partner/orders/${newOrder.id}`);
}
