/**
 * Audit log writer (Phoenix WS2c Task 2c.2).
 *
 * Dual-run: Mongo `audit_logs` when DATABASE_PROVIDER=mongodb;
 * Supabase `audit_logs` otherwise.
 */

import '@/lib/server-only-guard';

import { isMongoPrimary } from '@/lib/db/provider';
import { getDb } from '@/lib/mongo';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

export type AuditMetadata = Record<string, unknown>;

/**
 * Persist an admin/security-relevant action.
 * Never throws to callers for telemetry failures — logs and returns false.
 */
export async function recordAudit(
  actorId: string,
  action: string,
  target: string,
  metadata: AuditMetadata = {}
): Promise<boolean> {
  try {
    if (isMongoPrimary()) {
      const db = await getDb();
      await db.collection('audit_logs').insertOne({
        actor_id: actorId,
        action,
        target,
        metadata,
        created_at: new Date(),
      });
      return true;
    }

    const admin = createAdminClient();
    const { error } = await admin.from('audit_logs').insert({
      user_id: actorId,
      action,
      resource_id: target,
      resource_type: typeof metadata.resource_type === 'string' ? metadata.resource_type : 'unknown',
      details: metadata,
    });
    if (error) {
      console.error('[audit] supabase insert failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[audit] recordAudit failed:', error);
    return false;
  }
}
