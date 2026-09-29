import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PAGES = new Set(['/login', '/signup', '/offline']);
const SESSION_COOKIES = ['__Host-spend_session', 'spend_session'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    // CSRF: state-changing API calls must come from this site's own pages.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const site = req.headers.get('sec-fetch-site');
      const origin = req.headers.get('origin');
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      let crossOrigin = Boolean(site && site !== 'same-origin');
      try {
        if (origin && new URL(origin).host !== host) crossOrigin = true;
      } catch {
        crossOrigin = true;
      }
      if (crossOrigin) {
        return NextResponse.json({ error: 'forbidden', message: 'Cross-site request blocked.' }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Pages: fast redirect when there's obviously no session (the real check happens server-side).
  const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
  if (!hasSession && !PUBLIC_PAGES.has(pathname)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Strict, per-request nonce CSP: only our own scripts can run.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `manifest-src 'self'`,
    `worker-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|icons/|sw.js|manifest.webmanifest|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
