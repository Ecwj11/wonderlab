import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const accessCookie = 'wl_access',
  refreshCookie = 'wl_refresh';
const credentialRoutes = [
  'auth/login',
  'auth/register',
  'auth/parent/login',
  'auth/parent/register',
  'auth/admin/login',
  'auth/child/login',
];
type Tokens = { accessToken: string; refreshToken: string; user: unknown };
const refreshFlights = new Map<string, { promise: Promise<Tokens | null>; expires: number }>();
const backend = () => {
  const value =
    process.env.BACKEND_INTERNAL_URL ||
    (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:4000' : '');
  if (!value) throw new Error('Backend is not configured');
  return value.replace(/\/$/, '');
};
function sessionCookies(response: NextResponse, tokens: Tokens) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  response.cookies.set(accessCookie, tokens.accessToken, { ...options, maxAge: 900 });
  response.cookies.set(refreshCookie, tokens.refreshToken, { ...options, maxAge: 604800 });
}
function clearCookies(response: NextResponse) {
  response.cookies.set(accessCookie, '', { path: '/', maxAge: 0 });
  response.cookies.set(refreshCookie, '', { path: '/', maxAge: 0 });
}
async function refresh(token: string): Promise<Tokens | null> {
  const key = createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  for (const [key, entry] of refreshFlights) if (entry.expires < now) refreshFlights.delete(key);
  let flight = refreshFlights.get(key);
  if (!flight) {
    const promise = fetch(backend() + '/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    }).then(async (r) => {
      if (r.ok) return (await r.json()) as Tokens;
      if ([400, 401, 403].includes(r.status)) return null;
      throw new Error('Session renewal temporarily unavailable');
    });
    flight = { promise, expires: now + 20000 };
    refreshFlights.set(key, flight);
  }
  try {
    return await flight.promise;
  } catch (error) {
    refreshFlights.delete(key);
    throw error;
  }
}
async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    if (path.some((p) => p === '..' || p.includes('/') || p.includes('\\')))
      return NextResponse.json(
        { error: { code: 'INVALID_PATH', message: 'Invalid API path.' } },
        { status: 400 },
      );
    const route = path.join('/'),
      isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const origin = req.headers.get('origin');
    const expectedOrigin = process.env.APP_ORIGIN
      ? new URL(process.env.APP_ORIGIN).origin
      : req.nextUrl.origin;
    if (
      isMutation &&
      ((origin && origin !== expectedOrigin) ||
        (!origin && req.cookies.has(refreshCookie) && !req.headers.has('authorization')))
    )
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_ORIGIN',
            message: 'This request must come from your learning portal.',
          },
        },
        { status: 403 },
      );
    let headers = new Headers();
    for (const key of ['content-type', 'authorization', 'accept']) {
      const value = req.headers.get(key);
      if (value) headers.set(key, value);
    }
    const token = req.cookies.get(accessCookie)?.value;
    const refreshToken = req.cookies.get(refreshCookie)?.value;
    if (!headers.has('authorization') && token) headers.set('authorization', 'Bearer ' + token);
    let requestBody: ArrayBuffer | string | undefined;
    if (isMutation) {
      if (Number(req.headers.get('content-length') || 0) > 11 * 1024 * 1024)
        return NextResponse.json(
          { error: { code: 'FILE_TOO_LARGE', message: 'Files must be 10 MB or smaller.' } },
          { status: 413 },
        );
      requestBody = await req.arrayBuffer();
      if (requestBody.byteLength > 11 * 1024 * 1024)
        return NextResponse.json(
          { error: { code: 'FILE_TOO_LARGE', message: 'Files must be 10 MB or smaller.' } },
          { status: 413 },
        );
    }
    if (route === 'auth/logout' || route === 'auth/refresh') {
      requestBody = JSON.stringify({ refreshToken: refreshToken || '' });
      headers.set('content-type', 'application/json');
    }
    const url = backend() + '/' + path.map(encodeURIComponent).join('/') + req.nextUrl.search;
    const forward = () =>
      fetch(url, {
        method: req.method,
        headers,
        body: requestBody,
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(90000),
      });
    let response = await forward();
    let renewed: Tokens | null = null;
    if (
      response.status === 401 &&
      refreshToken &&
      ![...credentialRoutes, 'auth/refresh', 'auth/logout'].includes(route)
    ) {
      renewed = await refresh(refreshToken);
      if (renewed) {
        headers = new Headers(headers);
        headers.set('authorization', 'Bearer ' + renewed.accessToken);
        response = await forward();
      }
    }
    if ([...credentialRoutes, 'auth/refresh'].includes(route) && response.ok) {
      const tokens = (await response.json()) as Tokens;
      const result = NextResponse.json({ user: tokens.user }, { status: response.status });
      sessionCookies(result, tokens);
      return result;
    }
    const result = new NextResponse(response.status === 204 ? null : await response.arrayBuffer(), {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
        'x-request-id': response.headers.get('x-request-id') || '',
      },
    });
    if (renewed) sessionCookies(result, renewed);
    if (route === 'auth/logout' || response.status === 401) clearCookies(result);
    return result;
  } catch (error) {
    const timeout =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return NextResponse.json(
      {
        error: {
          code: timeout ? 'UPSTREAM_TIMEOUT' : 'BACKEND_UNAVAILABLE',
          message: timeout
            ? 'This request took too long. Please try again.'
            : 'Your learning portal is temporarily unavailable. Please try again.',
        },
      },
      { status: timeout ? 504 : 502 },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
  proxy as HEAD,
};
