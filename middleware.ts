import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkRateLimit, getAuthLimiter, getUploadLimiter } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to auth endpoints
  if (pathname.startsWith('/api/auth/')) {
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
      // Allow request to proceed if rate limiting fails (fail-open)
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
      // Allow request to proceed if rate limiting fails (fail-open)
    }
  }

  // Check for required environment variables (warn but don't block)
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
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value, options }) =>
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

    if (userError && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return response;
    }

    const publicRoutes = ['/', '/books', '/genres', '/login', '/register', '/reset-password', '/api'];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    const authRoutes = ['/login', '/register', '/reset-password'];
    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    const isReadingRoute = pathname.startsWith('/reading');
    const isLibraryRoute = pathname.startsWith('/library');
    const isAuthorRoute = pathname.startsWith('/author');
    const isPartnerRoute = pathname.startsWith('/partner');
    const isAdminRoute = pathname.startsWith('/admin');

    if (user && isAuthRoute) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (!user) {
      if (isReadingRoute || isLibraryRoute || isAuthorRoute || isPartnerRoute || isAdminRoute) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    if (user) {
      if (isAdminRoute) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError || profile?.role !== 'admin') {
            return NextResponse.redirect(new URL('/', request.url));
          }
        } catch (error) {
          console.error('Error in admin route protection:', error);
          return NextResponse.redirect(new URL('/', request.url));
        }
      }

      if (isAuthorRoute) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError || (profile?.role !== 'author' && profile?.role !== 'admin')) {
            return NextResponse.redirect(new URL('/', request.url));
          }
        } catch (error) {
          console.error('Error in author route protection:', error);
          return NextResponse.redirect(new URL('/', request.url));
        }
      }

      if (isPartnerRoute) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError || (profile?.role !== 'partner' && profile?.role !== 'admin')) {
            return NextResponse.redirect(new URL('/', request.url));
          }
        } catch (error) {
          console.error('Error in partner route protection:', error);
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    }

    return response;
  } catch (error) {
    const publicRoutes = ['/', '/books', '/genres', '/login', '/register', '/reset-password', '/api'];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (isPublicRoute) {
      return response;
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
