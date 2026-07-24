/**
 * Email preference lookups (email_preferences table).
 *
 * Used by triggers before sending non-critical email. Contract:
 *  - Table missing / DB error → fall back to DEFAULT_EMAIL_PREFERENCES and
 *    log a warning. NEVER throws — email must degrade gracefully.
 *  - Marketing defaults OFF (explicit opt-in only); transactional categories
 *    (receipts, author alerts) default ON.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';

export type EmailCategory = 'marketing' | 'receipts' | 'author_alerts';

export interface EmailPreferences {
  marketing: boolean;
  receipts: boolean;
  author_alerts: boolean;
}

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  marketing: false,
  receipts: true,
  author_alerts: true,
};

let warnedMissingTable = false;

/** True when a PostgREST/Postgres error means the table isn't migrated yet. */
export function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    /does not exist|schema cache|could not find the table/i.test(error.message ?? '')
  );
}

/**
 * Fetch preferences for an auth user id (auth.users.id). Returns defaults
 * when no row exists or the table isn't migrated yet.
 */
export async function getEmailPreferences(authUserId: string): Promise<EmailPreferences> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('email_preferences')
      .select('marketing, receipts, author_alerts')
      .eq('user_id', authUserId)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        if (!warnedMissingTable) {
          warnedMissingTable = true;
          console.warn(
            '[email] email_preferences table not found — using defaults. ' +
              'Run the email_preferences migration to enable preference checks.'
          );
        }
      } else {
        console.error('[email] Failed to load email preferences:', error);
      }
      return DEFAULT_EMAIL_PREFERENCES;
    }

    if (!data) {
      return DEFAULT_EMAIL_PREFERENCES;
    }

    return {
      marketing: Boolean(data.marketing),
      receipts: Boolean(data.receipts),
      author_alerts: Boolean(data.author_alerts),
    };
  } catch (error) {
    console.error('[email] Unexpected error loading email preferences:', error);
    return DEFAULT_EMAIL_PREFERENCES;
  }
}

/** True when the given category should be emailed to this user. Never throws. */
export async function shouldSendEmail(
  authUserId: string,
  category: EmailCategory
): Promise<boolean> {
  const prefs = await getEmailPreferences(authUserId);
  return prefs[category];
}
