'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** Seconds remaining until the current session expires, or null if unknown. */
  sessionExpiresIn: number | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  sessionExpiresIn: null,
  signOut: async () => {},
  refreshSession: async () => {},
});

/** How many seconds before expiry to proactively refresh the session. */
const PROACTIVE_REFRESH_BUFFER_S = 5 * 60; // 5 minutes
/** How often to check whether a proactive refresh is needed (ms). */
const REFRESH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiresIn, setSessionExpiresIn] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();
  // Keep a ref to the latest session so the interval always sees fresh data.
  const sessionRef = useRef<Session | null>(null);

  const applySession = (s: Session | null) => {
    setSession(s);
    setUser(s?.user ?? null);
    sessionRef.current = s;
    if (s?.expires_at) {
      setSessionExpiresIn(s.expires_at - Math.floor(Date.now() / 1000));
    } else {
      setSessionExpiresIn(null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      setIsLoading(false);
    });

    // Listen for all auth state changes, including token refreshes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      applySession(session);
      setIsLoading(false);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  // Proactively refresh the token shortly before it expires so long-lived
  // reading sessions (e.g. 30+ minutes idle in a background tab) never
  // experience a sudden logout.
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const current = sessionRef.current;
      if (!current?.expires_at) return;

      const secondsLeft = current.expires_at - Math.floor(Date.now() / 1000);
      setSessionExpiresIn(secondsLeft);

      if (secondsLeft > 0 && secondsLeft <= PROACTIVE_REFRESH_BUFFER_S) {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            applySession(data.session);
          }
        } catch {
          // Non-fatal: the Supabase client will also attempt a refresh on the
          // next API call. Swallow the error to avoid noisy console output.
        }
      }
    }, REFRESH_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const refreshSession = async () => {
    const { data } = await supabase.auth.refreshSession();
    applySession(data.session);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        sessionExpiresIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
