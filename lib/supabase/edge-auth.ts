import type { NextRequest } from 'next/server';

type EdgeAuthUser = {
  userId: string | null;
  accessToken: string | null;
};

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function getStorageKeyFromSupabaseUrl(supabaseUrl: string): string | null {
  try {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function readChunkedCookie(request: NextRequest, key: string): string | null {
  const direct = request.cookies.get(key)?.value;
  if (direct) return direct;

  const parts: string[] = [];
  for (let i = 0; i < 50; i++) {
    const part = request.cookies.get(`${key}.${i}`)?.value;
    if (!part) break;
    parts.push(part);
  }
  return parts.length > 0 ? parts.join('') : null;
}

function looksLikeJwt(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function tokenFromParsedSession(parsed: unknown): string | null {
  if (!parsed) return null;
  if (typeof parsed === 'string') return looksLikeJwt(parsed) ? parsed : null;

  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const token = tokenFromParsedSession(entry);
      if (token) return token;
    }
    return null;
  }

  if (typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    const accessToken = record.access_token;
    if (typeof accessToken === 'string' && accessToken.length > 0) {
      return accessToken;
    }
    return tokenFromParsedSession(record.currentSession);
  }

  return null;
}

function parseAccessTokenFromCookie(rawCookie: string): string | null {
  const candidates = [rawCookie];

  try {
    candidates.push(decodeURIComponent(rawCookie));
  } catch {
    // Cookie may already be decoded.
  }

  for (const candidate of candidates) {
    if (looksLikeJwt(candidate)) return candidate;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const token = tokenFromParsedSession(parsed);
      if (token) return token;
    } catch {
      // Non-JSON values are handled by JWT check above.
    }
  }

  return null;
}

function readAccessTokenFromCookies(request: NextRequest): string | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  const storageKey = getStorageKeyFromSupabaseUrl(config.url);
  const candidateKeys = [
    storageKey,
    'sb-auth-token',
    'supabase-auth-token',
    'sb-access-token',
  ].filter((value): value is string => Boolean(value));

  for (const key of candidateKeys) {
    const raw = readChunkedCookie(request, key);
    if (!raw) continue;
    const token = parseAccessTokenFromCookie(raw);
    if (token) return token;
  }

  return null;
}

async function fetchSupabaseUserId(accessToken: string): Promise<string | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const body = (await response.json()) as { id?: string };
  return typeof body.id === 'string' && body.id.length > 0 ? body.id : null;
}

export async function getEdgeAuthUser(request: NextRequest): Promise<EdgeAuthUser> {
  const accessToken = readAccessTokenFromCookies(request);
  if (!accessToken) {
    return { userId: null, accessToken: null };
  }

  const userId = await fetchSupabaseUserId(accessToken);
  if (!userId) {
    return { userId: null, accessToken: null };
  }

  return { userId, accessToken };
}

export async function getEdgeUserRole(
  accessToken: string,
  userId: string
): Promise<string | undefined> {
  const config = getSupabaseConfig();
  if (!config) return undefined;

  const params = new URLSearchParams({
    select: 'role',
    user_id: `eq.${userId}`,
    limit: '1',
  });

  const response = await fetch(`${config.url}/rest/v1/profiles?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) return undefined;
  const rows = (await response.json()) as Array<{ role?: string }>;
  return rows[0]?.role;
}
