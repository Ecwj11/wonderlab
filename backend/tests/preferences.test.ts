import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Preferences tests require a test database');
const { createApp } = await import('../src/app.js');
const { migrate } = await import('../src/db/migrate.js');
const { pool, run } = await import('../src/db/pool.js');
const app = createApp();
let userId = '';
let token = '';
beforeAll(async () => {
  await migrate();
  const account = await request(app)
    .post('/auth/register')
    .send({
      name: 'Language learner',
      email: randomUUID() + '@example.com',
      password: 'SafePassword123!',
    });
  expect(account.status).toBe(201);
  userId = account.body.user.id;
  token = account.body.accessToken;
});
afterAll(async () => {
  if (userId) await run('DELETE FROM users WHERE id=?', [userId]);
  await pool.end();
});
const auth = () => ({ Authorization: 'Bearer ' + token });
describe('Per-user learning interface language', () => {
  it('defaults new accounts to English and requires authentication', async () => {
    const response = await request(app).get('/preferences').set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ uiLanguage: 'en' });
    expect((await request(app).get('/preferences')).status).toBe(401);
  });
  it('persists Chinese and bilingual preferences independently for each account', async () => {
    const other = await request(app)
      .post('/auth/register')
      .send({
        name: 'Other learner',
        email: randomUUID() + '@example.com',
        password: 'SafePassword123!',
      });
    try {
      for (const uiLanguage of ['zh', 'en-zh', 'en']) {
        const saved = await request(app).patch('/preferences').set(auth()).send({ uiLanguage });
        expect(saved.status).toBe(200);
        expect(saved.body).toEqual({ uiLanguage });
        expect((await request(app).get('/preferences').set(auth())).body).toEqual({ uiLanguage });
        expect(
          (
            await request(app)
              .get('/preferences')
              .set({ Authorization: 'Bearer ' + other.body.accessToken })
          ).body,
        ).toEqual({ uiLanguage: 'en' });
      }
    } finally {
      await run('DELETE FROM users WHERE id=?', [other.body.user.id]);
    }
  });
  it('rejects unsupported languages and attempts to update someone else', async () => {
    for (const body of [{ uiLanguage: 'ms' }, { uiLanguage: 'zh', userId: randomUUID() }, {}]) {
      expect((await request(app).patch('/preferences').set(auth()).send(body)).status).toBe(400);
    }
    expect((await request(app).get('/preferences').set(auth())).body).toEqual({ uiLanguage: 'en' });
  });
});
