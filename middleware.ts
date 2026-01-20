import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables. Check .env.local.example for setup instructions.');
    // Allow request to proceed but log error - health check endpoint will catch this
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

    // If auth fails due to config issues, allow public routes to proceed
    if (userError && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return response;
    }

    const { pathname } = request.nextUrl;

    // Public routes
    const publicRoutes = ['/', '/books', '/genres', '/login', '/register', '/reset-password', '/api'];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

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

    // Check role-based access
    if (user) {
      // Admin route protection
      if (isAdminRoute) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile for admin check:', profileError.message);
            return NextResponse.redirect(new URL('/', request.url));
          }

          if (profile?.role !== 'admin') {
            return NextResponse.redirect(new URL('/', request.url));
          }
        } catch (error) {
          console.error('Error in admin route protection:', error);
          return NextResponse.redirect(new URL('/', request.url));
        }
      }

      // Author route protection
      if (isAuthorRoute) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile for author check:', profileError.message);
            return NextResponse.redirect(new URL('/', request.url));
          }

          if (profile?.role !== 'author' && profile?.role !== 'admin') {
            return NextResponse.redirect(new URL('/', request.url));
          }
        } catch (error) {
          console.error('Error in author route protection:', error);
          return NextResponse.redirect(new URL('/', request.url));
        }
      }

      // Partner route protection
      if (isPartnerRoute) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile for partner check:', profileError.message);
            return NextResponse.redirect(new URL('/', request.url));
          }

          if (profile?.role !== 'partner' && profile?.role !== 'admin') {
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
    // If middleware fails completely, allow public routes to proceed
    const { pathname } = request.nextUrl;
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
