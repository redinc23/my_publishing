'use client';

import * as React from 'react';
import { BellRing, Loader2, Mail, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface Preferences {
  marketing: boolean;
  receipts: boolean;
  author_alerts: boolean;
}

type PreferenceKey = keyof Preferences;

const DEFAULTS: Preferences = {
  marketing: false,
  receipts: true,
  author_alerts: true,
};

const ROWS: Array<{
  key: PreferenceKey;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}> = [
  {
    key: 'marketing',
    icon: Mail,
    title: 'News & recommendations',
    description: 'New releases, curated picks, and occasional MANGU news.',
  },
  {
    key: 'receipts',
    icon: Receipt,
    title: 'Purchase receipts',
    description: 'Order confirmations and download links after every purchase.',
  },
  {
    key: 'author_alerts',
    icon: BellRing,
    title: 'Author alerts',
    description: 'New reviews of your books and royalty payout notifications.',
  },
];

/**
 * Email notification preferences (marketing / receipts / author alerts),
 * backed by GET+PUT /api/email/preferences and the email_preferences table.
 *
 * Wiring: drop <EmailPreferences /> into a dashboard settings page (e.g.
 * app/dashboard/settings). It self-fetches, requires an authenticated
 * session, and degrades to a quiet unavailable state when the email backend
 * isn't migrated/configured yet.
 */
export function EmailPreferences() {
  const [prefs, setPrefs] = React.useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<PreferenceKey | null>(null);
  const [unavailable, setUnavailable] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/email/preferences', { cache: 'no-store' });
        if (res.status === 401) {
          if (!cancelled) setUnavailable('Sign in to manage your email preferences.');
          return;
        }
        if (!res.ok) {
          if (!cancelled) setUnavailable('Email preferences are not available yet.');
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.preferences) {
          setPrefs({ ...DEFAULTS, ...data.preferences });
        }
      } catch {
        if (!cancelled) setUnavailable('Email preferences are not available yet.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(key: PreferenceKey, checked: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: checked };
    setPrefs(next);
    setSavingKey(key);

    try {
      const res = await fetch('/api/email/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: checked }),
      });

      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);
      }

      const data = await res.json();
      if (data?.preferences) {
        setPrefs({ ...DEFAULTS, ...data.preferences });
      }
      toast.success('Email preferences updated');
    } catch {
      setPrefs(previous);
      toast.error('Could not save preferences. Please try again.');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading email preferences…</span>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/40 p-6">
        <p className="text-sm text-muted-foreground">{unavailable}</p>
      </div>
    );
  }

  return (
    <section
      aria-label="Email preferences"
      className="rounded-lg border border-border/60 bg-card/40"
    >
      <header className="border-b border-border/60 px-6 py-4">
        <h3 className="text-base font-semibold text-foreground">Email notifications</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what lands in your inbox. Changes save instantly.
        </p>
      </header>
      <ul className="divide-y divide-border/60">
        {ROWS.map(({ key, icon: Icon, title, description }) => {
          const saving = savingKey === key;
          return (
            <li key={key} className="flex items-start gap-4 px-6 py-4">
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`email-pref-${key}`}
                  className="block cursor-pointer text-sm font-medium text-foreground"
                >
                  {title}
                </label>
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : null}
                <Checkbox
                  id={`email-pref-${key}`}
                  checked={prefs[key]}
                  disabled={savingKey !== null}
                  onCheckedChange={(checked) => toggle(key, checked === true)}
                  aria-label={title}
                  className={cn('h-5 w-5 rounded border-border data-[state=checked]:bg-primary')}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default EmailPreferences;
