import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit, getRateLimitIdentity } from '@/lib/rate-limit';
import { getEdgeAuthUser, getEdgeUserRole } from '@/lib/supabase/edge-auth';

/** Reject a request per rate-limit result: 429 when limited, 503 when the limiter is unavailable (fail-closed). */
function rateLimitRejection(result: { reason: string; headers: Record<string, string> }) {
  if (result.reason === 'unavailable') {
    return new NextResponse('Service Unavailable', {
      status: 503,
      headers: result.headers,
    });
  }
  return new NextResponse('Too Many Requests', {
    status: 429,
    headers: result.headers,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Rate limiting (fail-closed, Fix C8) ────────────────────────────────────
  // Apply to /api/auth/* endpoints AND to server-action POSTs on auth pages.
  // Next.js server actions POST to the page URL itself (with next-action header).
  // Identity: platform-verified request.ip first, then the spoof-resistant
  // resolver (rightmost valid XFF hop / ephemeral identity) — client-supplied
  // XFF chains are never trusted directly (directive Phase 6).
  const isAuthApiPath = pathname.startsWith('/api/auth/');
  const isAuthPageAction =
    method === 'POST' &&
    (pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/verify-email'));

  if (isAuthApiPath || isAuthPageAction) {
    const ip = request.ip ?? getRateLimitIdentity(request);
    const result = await enforceRateLimit('auth', ip);

    if (!result.success) {
      return rateLimitRejection(result);
    }
  }

  // Apply rate limiting to upload endpoints (exact API prefix only — a loose
  // substring match previously rate-limited any URL containing "upload").
  if (pathname.startsWith('/api/upload')) {
    const ip = request.ip ?? getRateLimitIdentity(request);
    const result = await enforceRateLimit('upload', ip);

    if (!result.success) {
      return rateLimitRejection(result);
    }
  }

  // Abuse-sensitive public POST endpoints without their own limiter:
  // newsletter signup (email spam via Resend) and checkout session creation.
  const isAbusablePublicPost =
    method === 'POST' &&
    (pathname.startsWith('/api/newsletter') || pathname.startsWith('/api/checkout'));

  if (isAbusablePublicPost) {
    const ip = request.ip ?? getRateLimitIdentity(request);
    const result = await enforceRateLimit('api', ip);

    if (!result.success) {
      return rateLimitRejection(result);
    }
  }

  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error(
      'Missing Supabase environment variables. Check .env.local.example for setup instructions.'
    );
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return response;
    }

    const authUser = await getEdgeAuthUser(request);
    const userId = authUser.userId;

    // Auth routes
    const isPasswordRecoveryConfirm = pathname === '/reset-password/confirm';
    const authRoutes = ['/login', '/register', '/reset-password'];
    const isAuthRoute =
      !isPasswordRecoveryConfirm && authRoutes.some((route) => pathname.startsWith(route));

    // Protected routes
    const isReadingRoute = pathname.startsWith('/reading');
    const isLibraryRoute = pathname.startsWith('/library');
    // Note: '/author/...' (portal) must not match public '/authors' pages.
    const isAuthorRoute = pathname === '/author' || pathname.startsWith('/author/');
    const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');
    const isAdminRoute = pathname.startsWith('/admin');

    // Redirect logged-in users away from auth pages
    if (userId && isAuthRoute) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Redirect unauthenticated users from protected routes
    if (!userId) {
      if (isReadingRoute || isLibraryRoute || isAuthorRoute || isPartnerRoute || isAdminRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // ── Role-based access control ────────────────────────────────────────────
    // Fetch the user profile exactly once, shared across all role-gated checks.
    if (userId && authUser.accessToken && (isAdminRoute || isAuthorRoute || isPartnerRoute)) {
      let role: string | undefined;

      try {
        role = await getEdgeUserRole(authUser.accessToken, userId);
        if (!role) {
          console.error('Error fetching profile for role check: missing role');
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch (error) {
        console.error('Error in role-based route protection:', error);
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isAdminRoute && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isAuthorRoute && role !== 'author' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (isPartnerRoute && role !== 'partner' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return response;
  } catch (error) {
    // If middleware fails completely, allow public routes to proceed
    const publicRoutes = [
      '/',
      '/books',
      '/genres',
      '/authors',
      '/about',
      '/audio',
      '/comics',
      '/contact',
      '/discover',
      '/papers',
      '/readers-hub',
      '/login',
      '/register',
      '/reset-password',
      '/verify-email',
      '/api',
    ];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (isPublicRoute) {
      return response;
    }

    // For protected routes, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
