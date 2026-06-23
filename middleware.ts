// PERF-PHASE2-9
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, getAuthLimiter, getUploadLimiter } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Apply to /api/auth/* endpoints AND to server-action POSTs on auth pages.
  // Next.js server actions POST to the page URL itself (with next-action header).
  const isAuthApiPath = pathname.startsWith('/api/auth/');
  const isAuthPageAction =
    method === 'POST' &&
    (pathname.startsWith('/login') ||
      pathname.startsWith('/register') ||
      pathname.startsWith('/reset-password'));

  if (isAuthApiPath || isAuthPageAction) {
    try {
      const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const limiter = getAuthLimiter();
      const result = await checkRateLimit(ip, limiter);

      if (!result.success) {
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: result.headers,
        });
      }
    } catch (error) {
      console.error('Rate limit check failed for auth endpoint:', error);
      // Fail-open: allow the request if the rate-limiter is unavailable.
    }
  }

  // Apply rate limiting to upload endpoints
  if (pathname.startsWith('/api/upload') || pathname.includes('/upload')) {
    try {
      const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const limiter = getUploadLimiter();
      const result = await checkRateLimit(ip, limiter);

      if (!result.success) {
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: result.headers,
        });
      }
    } catch (error) {
      console.error('Rate limit check failed for upload endpoint:', error);
    }
  }

  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables. Check .env.local.example for setup instructions.');
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // If auth fails due to config issues, allow public routes to proceed
    if (userError && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return response;
    }

    // Auth routes
    const authRoutes = ['/login', '/register', '/reset-password'];
    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    // Protected routes
    const isReadingRoute = pathname.startsWith('/reading');
    const isLibraryRoute = pathname.startsWith('/library');
    const isAuthorRoute = pathname.startsWith('/author');
    const isPartnerRoute = pathname.startsWith('/partner');
    const isAdminRoute = pathname.startsWith('/admin');

    // Redirect logged-in users away from auth pages
    if (user && isAuthRoute) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Redirect unauthenticated users from protected routes
    if (!user) {
      if (isReadingRoute || isLibraryRoute || isAuthorRoute || isPartnerRoute || isAdminRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // ── Role-based access control ────────────────────────────────────────────
    // Fetch the user profile exactly once, shared across all role-gated checks.
    if (user && (isAdminRoute || isAuthorRoute || isPartnerRoute)) {
      let role: string | undefined;

      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile for role check:', profileError.message);
          return NextResponse.redirect(new URL('/', request.url));
        }

        role = profile?.role;
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
    const publicRoutes = ['/', '/books', '/genres', '/login', '/register', '/reset-password', '/api'];
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
