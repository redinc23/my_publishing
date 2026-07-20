'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { recordAudit } from '@/lib/audit';
import { getRequestAuthUser } from '@/lib/auth/request-user';
import { isMongoPrimary } from '@/lib/db/provider';
import { getDb } from '@/lib/mongo';
import { updateBookById } from '@/lib/mongo-books';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

type Role = 'reader' | 'author' | 'partner' | 'admin';
type BookStatus = 'draft' | 'published';
type ManuscriptStatus = 'accepted' | 'rejected';
type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

async function requireAdminForAction() {
  if (isMongoPrimary()) {
    const user = await getRequestAuthUser();
    if (!user) return { ok: false as const, error: 'Unauthorized' };
    if (user.role !== 'admin') return { ok: false as const, error: 'Admin access required' };
    return { ok: true as const, userId: user.id, profileId: user.id };
  }

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

  return { ok: true as const, userId: user.id, profileId: profile.id, user, profile };
}

function valueFrom(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function coerceId(id: string): ObjectId | string {
  return /^[a-fA-F0-9]{24}$/.test(id) ? new ObjectId(id) : id;
}

export async function updateBookStatusAction(formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return;

  const id = valueFrom(formData, 'bookId');
  const status = valueFrom(formData, 'status') as BookStatus;
  if (!id || !['draft', 'published'].includes(status)) {
    return;
  }

  if (isMongoPrimary()) {
    await updateBookById(id, { status });
    await recordAudit(auth.userId, 'CONTENT_STATUS', id, {
      resource_type: 'book',
      status,
    });
    revalidatePath('/admin/books');
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
  await recordAudit(auth.userId, 'CONTENT_STATUS', id, {
    resource_type: 'book',
    status,
  });
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

  if (isMongoPrimary()) {
    const db = await getDb();
    const filter =
      /^[a-fA-F0-9]{24}$/.test(profileId)
        ? { _id: new ObjectId(profileId) }
        : { $or: [{ _id: profileId }, { auth_user_id: profileId }] };

    const target = await db.collection('profiles').findOne(filter);
    if (!target) return;
    if (target.auth_user_id === auth.userId && role !== 'admin') return;

    await db.collection('profiles').updateOne(
      { _id: target._id },
      { $set: { role, updated_at: new Date() } }
    );
    await recordAudit(auth.userId, 'ROLE_CHANGE', String(target._id), {
      resource_type: 'profile',
      role,
      auth_user_id: target.auth_user_id,
    });
    revalidatePath('/admin/users');
    return;
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, user_id')
    .eq('id', profileId)
    .single();

  if (targetError || !target) return;
  if (target.user_id === auth.userId && role !== 'admin') {
    return;
  }

  const { error } = await admin
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) return;
  await recordAudit(auth.userId, 'ROLE_CHANGE', profileId, {
    resource_type: 'profile',
    role,
    user_id: target.user_id,
  });
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

  if (isMongoPrimary()) {
    const db = await getDb();
    await db.collection('manuscripts').updateOne(
      { _id: coerceId(id) },
      {
        $set: {
          status,
          editorial_notes: status === 'accepted' ? 'Approved by admin' : 'Rejected by admin',
          updated_at: new Date(),
        },
      }
    );
    await recordAudit(
      auth.userId,
      status === 'accepted' ? 'CONTENT_APPROVE' : 'CONTENT_REJECT',
      id,
      { resource_type: 'manuscript', status }
    );
    revalidatePath('/admin/manuscripts');
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
  await recordAudit(
    auth.userId,
    status === 'accepted' ? 'CONTENT_APPROVE' : 'CONTENT_REJECT',
    id,
    { resource_type: 'manuscript', status }
  );
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

  if (isMongoPrimary()) {
    const db = await getDb();
    const mongoStatus =
      status === 'cancelled' || status === 'processing' ? 'pending' : status;
    // Map admin UI statuses onto Phoenix OrderStatus where needed.
    const mapped =
      mongoStatus === 'pending' ||
      mongoStatus === 'completed' ||
      mongoStatus === 'failed' ||
      mongoStatus === 'refunded'
        ? mongoStatus
        : 'pending';
    await db.collection('orders').updateOne(
      { _id: coerceId(id) },
      { $set: { status: mapped, updated_at: new Date() } }
    );
    await recordAudit(auth.userId, 'ORDER_STATUS', id, {
      resource_type: 'order',
      status: mapped,
    });
    revalidatePath('/admin/orders');
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return;
  await recordAudit(auth.userId, 'ORDER_STATUS', id, {
    resource_type: 'order',
    status,
  });
  revalidatePath('/admin/orders');
}
