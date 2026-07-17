'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

type Role = 'reader' | 'author' | 'partner' | 'admin';
type BookStatus = 'draft' | 'published';
type ManuscriptStatus = 'accepted' | 'rejected';
type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

async function requireAdminForAction() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, error: 'Unauthorized' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, role')
    .eq('user_id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return { ok: false as const, error: 'Admin access required' };
  }

  return { ok: true as const, user, profile };
}

function valueFrom(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function updateBookStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'bookId');
  const status = valueFrom(formData, 'status') as BookStatus;
  if (!id || !['draft', 'published'].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('books')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return;
  revalidatePath('/admin/books');
}

export async function updateUserRoleAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const profileId = valueFrom(formData, 'profileId');
  const role = valueFrom(formData, 'role') as Role;
  if (!profileId || !['reader', 'author', 'partner', 'admin'].includes(role)) {
    return;
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, user_id')
    .eq('id', profileId)
    .single();

  if (targetError || !target) return;
  if (target.user_id === auth.user.id && role !== 'admin') {
    return;
  }

  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) return;
  revalidatePath('/admin/users');
}

export async function updateManuscriptStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'manuscriptId');
  const status = valueFrom(formData, 'status') as ManuscriptStatus;
  if (!id || !['accepted', 'rejected'].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('manuscripts')
    .update({
      status,
      editorial_notes: status === 'accepted' ? 'Approved by admin' : 'Rejected by admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return;
  revalidatePath('/admin/manuscripts');
}

export async function updateOrderStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'orderId');
  const status = valueFrom(formData, 'status') as OrderStatus;
  if (!id || !['pending', 'processing', 'completed', 'cancelled', 'refunded'].includes(status)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return;
  revalidatePath('/admin/orders');
}
