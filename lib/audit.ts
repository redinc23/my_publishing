/**
 * Audit log writer (Phoenix WS2c Task 2c.2).
 *
 * Dual-run: writes to Mongo `audit_logs` when DATABASE_PROVIDER=mongodb,
 * otherwise to Supabase `audit_logs`.
 */

import '@/lib/server-only-guard';

import { getDb } from '@/lib/mongo';
import { isMongoPrimary } from '@/lib/db/provider';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export type AuditMetadata = Record<string, unknown>;

export async function recordAudit(
  actorId: string,
  action: string,
  target: string,
  metadata: AuditMetadata = {}
): Promise<void> {
  const createdAt = new Date();

  if (isMongoPrimary()) {
    const db = await getDb();
    await db.collection('audit_logs').insertOne({
      actor_id: actorId,
      action,
      target,
      metadata,
      created_at: createdAt,
    });
    return;
  }

  const admin = createAdminClient();
  await admin.from('audit_logs').insert({
    user_id: actorId,
    action,
    resource_id: target,
    resource_type: typeof metadata.resource_type === 'string' ? metadata.resource_type : 'unknown',
    details: metadata,
    created_at: createdAt.toISOString(),
  });
}
