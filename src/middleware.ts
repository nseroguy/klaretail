import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass public auth routes & webhooks & static assets
  if (
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/vendor/auth') ||
    pathname.startsWith('/api/vendor/staff/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname === '/admin/login' ||
    pathname === '/vendor/login' ||
    pathname.startsWith('/vendor/terminal') ||
    pathname === '/dispatch/login' ||
    pathname.startsWith('/store') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const isSuperAdminRoute = pathname.startsWith('/admin/super') || pathname.startsWith('/api/admin/super');
  const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isVendorRoute = pathname.startsWith('/vendor');
  const isVendorApi = pathname.startsWith('/api/vendor');
  const isDispatchRoute = pathname.startsWith('/dispatch');
  const isDispatchApi = pathname.startsWith('/api/dispatch');
  const isApi = pathname.startsWith('/api/');

  if (isSuperAdminRoute || isAdminRoute || isVendorRoute || isVendorApi || isDispatchRoute || isDispatchApi) {
    const rawCookie = request.cookies.get('session_token')?.value || 
                      request.cookies.get('staff_session')?.value ||
                      request.cookies.get('klaretail_session')?.value;

    if (!rawCookie) {
      if (isApi) {
        return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
      }
      const loginUrl = isDispatchRoute ? '/dispatch/login' : isVendorRoute ? '/vendor/login' : '/admin/login';
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    let userRole: string | null = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) {
        decoded = decodeURIComponent(decoded);
      }
      const parsed = JSON.parse(decoded);
      userRole = parsed?.role || null;
    } catch {
      try {
        let b64 = rawCookie;
        while (b64.includes('%')) {
          b64 = decodeURIComponent(b64);
        }
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        userRole = parsed?.role || null;
      } catch {
        userRole = null;
      }
    }

    if (!userRole) {
      if (isApi) {
        return NextResponse.json({ success: false, message: 'Unauthorized: Invalid session format.' }, { status: 401 });
      }
      const loginUrl = isDispatchRoute ? '/dispatch/login' : isVendorRoute ? '/vendor/login' : '/admin/login';
      return NextResponse.redirect(new URL(loginUrl, request.url));
    }

    // Super Admin authorization
    if (isSuperAdminRoute) {
      if (userRole !== 'super_admin') {
        if (isApi) {
          return NextResponse.json({ success: false, message: 'Forbidden: Super Admin role required.' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }

    // Admin authorization
    if (isAdminRoute && !isSuperAdminRoute) {
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        if (isApi) {
          return NextResponse.json({ success: false, message: 'Forbidden: Admin access required.' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    }

    // Vendor authorization (allow owners, admins, and operational roles)
    if (isVendorRoute || isVendorApi) {
      const allowedVendorRoles = ['vendor_cashier', 'vendor_kitchen', 'vendor_staff', 'vendor_owner', 'vendor_admin', 'cashier', 'kitchen_staff', 'waiter', 'admin', 'super_admin'];
      if (!allowedVendorRoles.includes(userRole)) {
        if (isApi) {
          return NextResponse.json({ success: false, message: 'Forbidden: Vendor privileges required.' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/vendor/login', request.url));
      }
    }

    // Dispatch authorization
    if (isDispatchRoute || isDispatchApi) {
      const allowedDispatchRoles = ['driver', 'rider', 'dispatch_manager', 'admin', 'super_admin'];
      if (!allowedDispatchRoles.includes(userRole)) {
        if (isApi) {
          return NextResponse.json({ success: false, message: 'Forbidden: Dispatch access required.' }, { status: 403 });
        }
        return NextResponse.redirect(new URL('/dispatch/login', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/vendor/:path*',
    '/dispatch/:path*',
    '/api/admin/:path*',
    '/api/vendor/:path*',
    '/api/dispatch/:path*',
  ],
};
