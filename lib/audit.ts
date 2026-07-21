/**
 * Audit log writer — Phoenix WS2c Task 2c.2.
 *
 * `recordAudit(actorId, action, target, metadata)` → `audit_logs` insert.
 * Dual-run: Mongo when DATABASE_PROVIDER=mongodb; else Supabase `audit_logs`.
 */

import '@/lib/server-only-guard';

import type { Db } from 'mongodb';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isMongoPrimary } from '@/lib/db/provider';
import { getDb } from '@/lib/mongo';

export type AuditMetadata = Record<string, unknown>;

export async function recordAudit(
  actorId: string,
  action: string,
  target: string,
  metadata: AuditMetadata = {},
  db?: Db
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedAction = action.trim();
  const trimmedTarget = target.trim();
  if (!actorId || !trimmedAction || !trimmedTarget) {
    return { ok: false, error: 'actorId, action, and target are required' };
  }

  const now = new Date();

  try {
    if (isMongoPrimary()) {
      const database = db ?? (await getDb());
      await database.collection('audit_logs').insertOne({
        actor_id: actorId,
        action: trimmedAction,
        target: trimmedTarget,
        metadata,
        created_at: now,
      });
      return { ok: true };
    }

    const admin = createAdminClient();
    const { error } = await admin.from('audit_logs').insert({
      user_id: actorId,
      action: trimmedAction,
      resource_id: trimmedTarget,
      resource_type:
        typeof metadata.resource_type === 'string' ? metadata.resource_type : 'unknown',
      details: metadata,
      created_at: now.toISOString(),
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'audit write failed';
    console.error('[audit] recordAudit failed:', message);
    return { ok: false, error: message };
  }
}
