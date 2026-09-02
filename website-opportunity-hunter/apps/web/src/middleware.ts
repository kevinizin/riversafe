import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'woh_session';
const PUBLIC_PATHS = ['/login', '/api/health'];

/**
 * A cheap gate in front of every page.
 *
 * It only checks that a session cookie exists — the signature is verified in
 * the page itself by `requireUser()`, which also confirms the account is still
 * active. Doing the full check here as well would double every database read
 * for no extra safety.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (!request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
