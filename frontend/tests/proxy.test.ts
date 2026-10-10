import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../src/app/api/[...path]/route';
const context = (...path: string[]) => ({ params: Promise.resolve({ path }) });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('renews an expired access session when reading the current user', async () => {
  const upstream = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ error: {} }, { status: 401 }))
    .mockResolvedValueOnce(
      Response.json({
        accessToken: 'renewed-access',
        refreshToken: 'renewed-refresh',
        user: { id: 'student' },
      }),
    )
    .mockResolvedValueOnce(Response.json({ id: 'student' }));
  vi.stubGlobal('fetch', upstream);
  const response = await GET(
    new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: 'wl_refresh=valid-refresh-session' },
    }),
    context('auth', 'me'),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'student' });
  expect(response.cookies.get('wl_access')?.value).toBe('renewed-access');
  expect(response.cookies.get('wl_refresh')?.value).toBe('renewed-refresh');
  expect(upstream).toHaveBeenCalledTimes(3);
});
it('keeps session tokens in HTTP-only cookies and outside login JSON', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        accessToken: 'secret-access',
        refreshToken: 'secret-refresh',
        user: { id: 'student' },
      }),
    ),
  );
  const response = await POST(
    new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com', password: 'password' }),
    }),
    context('auth', 'login'),
  );
  expect(await response.json()).toEqual({ user: { id: 'student' } });
  expect(response.cookies.get('wl_access')?.httpOnly).toBe(true);
  expect(response.cookies.get('wl_refresh')?.httpOnly).toBe(true);
});
it('rejects cross-origin cookie mutations before forwarding', async () => {
  const upstream = vi.fn();
  vi.stubGlobal('fetch', upstream);
  const response = await POST(
    new NextRequest('http://localhost:3000/api/lessons/generate', {
      method: 'POST',
      headers: { origin: 'http://untrusted.example', cookie: 'wl_refresh=session' },
      body: '{}',
    }),
    context('lessons', 'generate'),
  );
  expect(response.status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});
it('returns a consistent error when the backend is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect failed')));
  const response = await GET(
    new NextRequest('http://localhost:3000/api/lessons'),
    context('lessons'),
  );
  expect(response.status).toBe(502);
  expect((await response.json()).error.code).toBe('BACKEND_UNAVAILABLE');
});
it('preserves refresh credentials during a temporary refresh outage', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ error: {} }, { status: 503 })),
  );
  const response = await GET(
    new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: 'wl_refresh=temporary-outage-session' },
    }),
    context('auth', 'me'),
  );
  expect(response.status).toBe(502);
  expect(response.headers.get('set-cookie')).toBeNull();
});
it('checks browser mutations against the public origin when the server listens internally', async () => {
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ lessonId: 'lesson', jobId: 'job' }, { status: 202 })),
  );
  const response = await POST(
    new NextRequest('http://0.0.0.0:3000/api/lessons/generate', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        cookie: 'wl_refresh=session',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
    context('lessons', 'generate'),
  );
  expect(response.status).toBe(202);
});
it.each(['parent/login', 'parent/register', 'admin/login', 'child/login'])(
  'keeps %s portal credentials in HTTP-only cookies',
  async (portal) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          accessToken: 'portal-access',
          refreshToken: 'portal-refresh',
          user: { id: 'family-user' },
        }),
      ),
    );
    const response = await POST(
      new NextRequest('http://localhost:3000/api/auth/' + portal, {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: '{}',
      }),
      context('auth', ...portal.split('/')),
    );
    expect(await response.json()).toEqual({ user: { id: 'family-user' } });
    expect(response.cookies.get('wl_access')?.httpOnly).toBe(true);
    expect(response.cookies.get('wl_refresh')?.httpOnly).toBe(true);
  },
);
it('does not retry failed child credentials with an unrelated active refresh session', async () => {
  const upstream = vi
    .fn()
    .mockResolvedValue(Response.json({ error: { code: 'INVALID_CREDENTIALS' } }, { status: 401 }));
  vi.stubGlobal('fetch', upstream);
  const response = await POST(
    new NextRequest('http://localhost:3000/api/auth/child/login', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        cookie: 'wl_refresh=other-account',
        'content-type': 'application/json',
      },
      body: '{}',
    }),
    context('auth', 'child', 'login'),
  );
  expect(response.status).toBe(401);
  expect(upstream).toHaveBeenCalledTimes(1);
});
