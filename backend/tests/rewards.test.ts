import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { User } from '@wonderlab/shared';
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
process.env.JOB_WORKER_ENABLED = 'false';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Rewards tests require an isolated test database');
const { createApp } = await import('../src/app.js');
const { migrate } = await import('../src/db/migrate.js');
const { pool, rows, run, transaction } = await import('../src/db/pool.js');
const { awardXp } = await import('../src/services/gamification.js');
const app = createApp();
interface Account {
  accessToken: string;
  refreshToken: string;
  user: User;
}
const auth = (a: Account) => ({ Authorization: 'Bearer ' + a.accessToken });
const cleanup: string[] = [];
let parent: Account, other: Account, child: Account, sibling: Account, outsider: Account;
let lessonId: string;
let siblingLessonId: string;
const prize = (extra = {}) => ({
  name: 'Ice cream together',
  description: 'Choose one scoop with mum or dad.',
  emoji: '🍦',
  starCost: 5,
  childId: null,
  isActive: true,
  ...extra,
});
const createPrize = async (extra = {}) => {
  const res = await request(app).post('/parent/rewards').set(auth(parent)).send(prize(extra));
  expect(res.status).toBe(201);
  return res.body;
};
const earn = async (
  key: string,
  event: { kind: 'LESSON' } | { kind: 'QUIZ'; correctAnswers: number; perfect: boolean } = {
    kind: 'LESSON',
  },
) => {
  // This exercises the real server gamification path, not an API that grants arbitrary currency.
  return transaction((db) => awardXp(child.user.id, lessonId, key, 50, 'Test learning', db, event));
};
const redeem = (id: string, requestId = randomUUID(), account = child) =>
  request(app)
    .post('/rewards/' + id + '/redeem')
    .set(auth(account))
    .send({ requestId });
const balance = async () =>
  (await request(app).get('/rewards/wallet').set(auth(child))).body.balance;
it('reward routes preserve public plan discovery and require authentication', async () => {
  expect((await request(app).get('/plans')).status).toBe(200);
  expect((await request(app).get('/rewards')).status).toBe(401);
  expect((await request(app).get('/parent/rewards')).status).toBe(401);
});
beforeAll(async () => {
  await migrate();
  const register = async () => {
    const res = await request(app)
      .post('/auth/parent/register')
      .send({
        name: 'Rewards Parent',
        familyName: 'Rewards Family',
        email: randomUUID() + '@example.com',
        password: 'qwer1234!Long',
      });
    expect(res.status).toBe(201);
    cleanup.push(res.body.user.id);
    return res.body as Account;
  };
  parent = await register();
  other = await register();
  const addChild = async (p: Account, username: string) => {
    const res = await request(app)
      .post('/parent/children')
      .set(auth(p))
      .send({ name: username, username, passcode: 'qwer1234!', schoolLevel: 'Primary 4' });
    expect(res.status).toBe(201);
    cleanup.push(res.body.id);
    const dashboard = await request(app).get('/parent/dashboard').set(auth(p));
    const login = await request(app)
      .post('/auth/child/login')
      .send({ familyCode: dashboard.body.family.code, username, passcode: 'qwer1234!' });
    expect(login.status).toBe(200);
    return login.body as Account;
  };
  child = await addChild(parent, 'alex');
  sibling = await addChild(parent, 'sibling');
  outsider = await addChild(other, 'outside');
  lessonId = randomUUID();
  await run(
    "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,?,'MATHEMATICS','English','Primary 4','READY','Fractions')",
    [lessonId, child.user.id, 'Rewards test lesson'],
  );
});
afterAll(async () => {
  for (const id of cleanup.reverse()) await run('DELETE FROM users WHERE id=?', [id]);
  await pool.end();
});

it('parent creates a family prize with a configurable star cost', async () => {
  const result = await createPrize();
  expect(result.starCost).toBe(5);
  expect(result.familyId).toBe(parent.user.familyId);
  const list = await request(app).get('/rewards').set(auth(child));
  expect(list.status).toBe(200);
  expect(list.body.data.some((r: { id: string }) => r.id === result.id)).toBe(true);
});
it('parents cannot access another family, and children cannot create prizes or change earning rules', async () => {
  const result = await createPrize();
  expect(
    (
      await request(app)
        .patch('/parent/rewards/' + result.id)
        .set(auth(other))
        .send(prize())
    ).status,
  ).toBe(404);
  expect((await request(app).post('/parent/rewards').set(auth(child)).send(prize())).status).toBe(
    403,
  );
  expect(
    (
      await request(app)
        .put('/parent/rewards/settings')
        .set(auth(child))
        .send({ lessonStars: 999, correctAnswerStars: 999, perfectQuizBonusStars: 999 })
    ).status,
  ).toBe(403);
  expect((await createPrize({ childId: sibling.user.id })).childId).toBe(sibling.user.id);
  expect(
    (
      await request(app)
        .post('/parent/rewards')
        .set(auth(parent))
        .send(prize({ childId: outsider.user.id }))
    ).status,
  ).toBe(404);
  expect((await redeem(result.id, randomUUID(), outsider)).status).toBe(404);
  const scoped = await createPrize({ childId: sibling.user.id });
  expect((await redeem(scoped.id)).status).toBe(404);
});
it('validates costs, disabled prizes, query pagination and payloads', async () => {
  for (const extra of [
    { starCost: 0 },
    { starCost: -5 },
    { starCost: 1.5 },
    { starCost: 1000001 },
    { emoji: '<script>' },
    { balance: 1000 },
  ])
    expect(
      (await request(app).post('/parent/rewards').set(auth(parent)).send(prize(extra))).status,
    ).toBe(400);
  const off = await createPrize({ isActive: false });
  expect((await redeem(off.id)).status).toBe(409);
  const ready = await createPrize();
  expect((await redeem(ready.id)).status).toBe(409);
  expect(
    (
      await request(app)
        .post('/rewards/' + ready.id + '/redeem')
        .set(auth(child))
        .send({ requestId: randomUUID(), starCost: 0 })
    ).status,
  ).toBe(400);
  expect((await request(app).get('/rewards?pageSize=1').set(auth(child))).body.pageSize).toBe(1);
  expect((await request(app).get('/rewards?page=-1').set(auth(child))).status).toBe(400);
});
it('validated learning endpoints award Stars only for completed activities and graded quizzes', async () => {
  const { saveDefinition } = await import('../src/services/lessons.js');
  siblingLessonId = randomUUID();
  await transaction(async (db) => {
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,?,'SCIENCE','English','Primary 4','READY','Plants need light')",
      [siblingLessonId, sibling.user.id, 'Growing a plant'],
      db,
    );
    await saveDefinition(
      siblingLessonId,
      {
        lessonSchemaVersion: 1,
        title: 'Growing a plant',
        subject: 'SCIENCE',
        language: 'English',
        objectives: ['Name what a plant needs'],
        scenes: [
          {
            id: 'flip',
            type: 'FLASHCARD',
            title: 'Plant discovery',
            explanation: 'Flip the card.',
            cards: [{ id: 'plant', front: 'What helps a plant grow?', back: 'Light and water.' }],
          },
          {
            id: 'quiz',
            type: 'QUIZ',
            title: 'Plant quiz',
            explanation: 'Choose an answer.',
            questions: [
              {
                id: 'q1',
                prompt: 'What helps a plant grow?',
                options: [
                  { id: 'a', label: 'Light' },
                  { id: 'b', label: 'Darkness' },
                ],
                correctOptionId: 'a',
                explanation: 'Plants use light to make food.',
              },
              {
                id: 'q2',
                prompt: 'What else does a plant need?',
                options: [
                  { id: 'a', label: 'Water' },
                  { id: 'b', label: 'Paint' },
                ],
                correctOptionId: 'a',
                explanation: 'Plants need water.',
              },
            ],
          },
        ],
      },
      db,
    );
  });
  const stars = async () =>
    (await request(app).get('/rewards/wallet').set(auth(sibling))).body.balance;
  const complete = (viewedIds: string[]) =>
    request(app)
      .post('/lessons/' + siblingLessonId + '/progress')
      .set(auth(sibling))
      .send({ sceneId: 'flip', result: { viewedIds } });
  expect((await complete(['fake'])).status).toBe(400);
  expect(await stars()).toBe(0);
  expect((await complete(['plant'])).status).toBe(200);
  expect(await stars()).toBe(0);
  const quiz = () =>
    request(app)
      .post('/lessons/' + siblingLessonId + '/quiz/submit')
      .set(auth(sibling))
      .send({
        sceneId: 'quiz',
        answers: [
          { questionId: 'q1', optionId: 'a' },
          { questionId: 'q2', optionId: 'a' },
        ],
      });
  const finished = await quiz();
  expect(finished.status).toBe(200);
  expect(finished.body.lessonCompleted).toBe(true);
  expect(await stars()).toBe(12);
  expect((await quiz()).body.xpEarned).toBe(0);
  await complete(['plant']);
  expect(await stars()).toBe(12);
});
it('learning awards configurable stars once without changing XP rules, including perfect quizzes', async () => {
  const settings = { lessonStars: 7, correctAnswerStars: 2, perfectQuizBonusStars: 3 };
  expect(
    (await request(app).put('/parent/rewards/settings').set(auth(parent)).send(settings)).status,
  ).toBe(200);
  const before = await balance();
  const key = 'complete:' + randomUUID();
  expect(await earn(key)).toBe(50);
  expect(await earn(key)).toBe(0);
  await earn('quiz:' + randomUUID(), { kind: 'QUIZ', correctAnswers: 2, perfect: true });
  expect(await balance()).toBe(before + 14);
  const me = await request(app).get('/auth/me').set(auth(child));
  expect(me.body.xp).toBe(100);
  expect(me.body.level).toBe(1);
  const history = await request(app).get('/rewards/transactions').set(auth(child));
  expect(history.body.data.filter((r: { kind: string }) => r.kind === 'EARN')).toHaveLength(2);
});
it('redeeming snapshots the prize, reserves stars once and rejects reused request IDs for another prize', async () => {
  const result = await createPrize();
  const before = await balance();
  const key = randomUUID();
  const first = await redeem(result.id, key);
  expect(first.status).toBe(201);
  expect(first.body.status).toBe('PENDING');
  const retry = await redeem(result.id, key);
  expect(retry.status).toBe(201);
  expect(retry.body.id).toBe(first.body.id);
  expect(await balance()).toBe(before - 5);
  expect((await redeem(result.id)).status).toBe(409);
  const second = await createPrize();
  expect((await redeem(second.id, key)).status).toBe(409);
  await request(app)
    .patch('/parent/rewards/' + result.id)
    .set(auth(parent))
    .send(prize({ name: 'Changed prize', starCost: 99 }));
  const requests = await request(app).get('/rewards/redemptions').set(auth(child));
  expect(requests.body.data.find((r: { id: string }) => r.id === first.body.id)).toMatchObject({
    name: 'Ice cream together',
    starCost: 5,
  });
  expect(
    (
      await request(app)
        .post('/rewards/redemptions/' + first.body.id + '/cancel')
        .set(auth(sibling))
        .send({})
    ).status,
  ).toBe(404);
  const cancel = () =>
    request(app)
      .post('/rewards/redemptions/' + first.body.id + '/cancel')
      .set(auth(child))
      .send({});
  expect((await cancel()).status).toBe(200);
  expect((await cancel()).status).toBe(200);
  expect(await balance()).toBe(before);
});
it('competing redemptions cannot overspend, and conflicting parent decisions refund at most once', async () => {
  const before = await balance();
  const a = await createPrize({ starCost: before });
  const b = await createPrize({ starCost: before });
  const results = await Promise.all([redeem(a.id), redeem(b.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await balance()).toBe(0);
  const id = results.find((r) => r.status === 201)!.body.id;
  const decision = () =>
    request(app)
      .patch('/parent/rewards/redemptions/' + id)
      .set(auth(parent))
      .send({ status: 'DECLINED', note: 'Choose something else together.' });
  const outcomes = await Promise.all([decision(), decision()]);
  expect(outcomes.map((r) => r.status)).toEqual([200, 200]);
  expect(await balance()).toBe(before);
  const [{ refunds }] = await rows<{ refunds: number }>(
    "SELECT COUNT(*) refunds FROM child_star_transactions WHERE child_id=? AND source_key=? AND kind='REFUND'",
    [child.user.id, 'refund:' + id],
  );
  expect(refunds).toBe(1);
  expect(
    (
      await request(app)
        .patch('/parent/rewards/redemptions/' + id)
        .set(auth(parent))
        .send({ status: 'FULFILLED' })
    ).status,
  ).toBe(409);
});
it('fulfilling keeps stars spent and leaves XP and achievements unchanged', async () => {
  const result = await createPrize();
  const before = await balance();
  const me = (await request(app).get('/auth/me').set(auth(child))).body;
  const redemption = (await redeem(result.id)).body;
  expect(
    (
      await request(app)
        .patch('/parent/rewards/redemptions/' + redemption.id)
        .set(auth(other))
        .send({ status: 'FULFILLED' })
    ).status,
  ).toBe(404);
  const give = () =>
    request(app)
      .patch('/parent/rewards/redemptions/' + redemption.id)
      .set(auth(parent))
      .send({ status: 'FULFILLED' });
  expect((await give()).status).toBe(200);
  expect((await give()).status).toBe(200);
  expect(
    (
      await request(app)
        .post('/rewards/redemptions/' + redemption.id + '/cancel')
        .set(auth(child))
        .send({})
    ).status,
  ).toBe(409);
  expect(await balance()).toBe(before - 5);
  expect((await request(app).get('/auth/me').set(auth(child))).body).toMatchObject({
    xp: me.xp,
    level: me.level,
  });
});
it('authentication remains available for earned prizes after expiry and daily exhaustion', async () => {
  const [{ code }] = await rows<{ code: string }>('SELECT code FROM families WHERE id=?', [
    parent.user.familyId,
  ]);
  const login = () =>
    request(app)
      .post('/auth/child/login')
      .send({ familyCode: code, username: 'sibling', passcode: 'qwer1234!' });
  try {
    await run('UPDATE families SET trial_ends_at=UTC_TIMESTAMP()-INTERVAL 1 DAY WHERE id=?', [
      parent.user.familyId,
    ]);
    expect((await login()).status).toBe(200);
    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: sibling.refreshToken });
    expect(refreshed.status).toBe(200);
    sibling = refreshed.body;
    expect((await request(app).get('/learning-access').set(auth(sibling))).body.canLearn).toBe(
      false,
    );
    expect((await request(app).get('/rewards/wallet').set(auth(sibling))).status).toBe(200);
    const blocked = await request(app)
      .post('/lessons/' + siblingLessonId + '/progress')
      .set(auth(sibling))
      .send({ sceneId: 'flip', result: { viewedIds: ['plant'] } });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('LEARNING_UNAVAILABLE');
    await run('UPDATE families SET trial_ends_at=UTC_TIMESTAMP()+INTERVAL 14 DAY WHERE id=?', [
      parent.user.familyId,
    ]);
    await run(
      "INSERT INTO child_daily_usage(child_id,local_date,learning_seconds) VALUES(?,DATE(CONVERT_TZ(UTC_TIMESTAMP(),'+00:00','+08:00')),1800) ON DUPLICATE KEY UPDATE learning_seconds=1800",
      [sibling.user.id],
    );
    const exhausted = await login();
    expect(exhausted.status).toBe(200);
    expect(
      (await request(app).get('/learning-access').set(auth(exhausted.body))).body.canLearn,
    ).toBe(false);
    expect((await request(app).get('/rewards/wallet').set(auth(exhausted.body))).status).toBe(200);
  } finally {
    await run('DELETE FROM child_daily_usage WHERE child_id=?', [sibling.user.id]);
    await run('UPDATE families SET trial_ends_at=UTC_TIMESTAMP()+INTERVAL 14 DAY WHERE id=?', [
      parent.user.familyId,
    ]);
  }
});
it('a pause committed while redemption is waiting on a wallet blocks the request', async () => {
  const result = await createPrize({ starCost: 1 });
  const holder = await pool.getConnection();
  const before = await balance();
  let waiting: Promise<request.Response> | undefined;
  try {
    await holder.beginTransaction();
    await rows(
      'SELECT child_id FROM child_star_wallets WHERE child_id=? FOR UPDATE',
      [child.user.id],
      holder,
    );
    waiting = redeem(result.id).then((response) => response);
    let blocked = false;
    for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
      const processes = await rows<{ Info: string | null }>('SHOW PROCESSLIST');
      blocked = processes.some(
        (p) =>
          p.Info?.includes('INSERT IGNORE INTO child_star_wallets') &&
          p.Info.includes(child.user.id),
      );
      if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(blocked).toBe(true);
    await run("UPDATE users SET status='SUSPENDED' WHERE id=?", [child.user.id]);
    await holder.rollback();
    expect((await waiting).status).toBe(403);
    expect(await balance()).toBe(before);
  } finally {
    await holder.rollback();
    holder.release();
    if (waiting) await waiting;
    await run("UPDATE users SET status='ACTIVE' WHERE id=?", [child.user.id]);
  }
});
it('earned prizes remain available after learning time is used, but suspended accounts cannot redeem', async () => {
  await run('UPDATE families SET trial_ends_at=UTC_TIMESTAMP()-INTERVAL 1 DAY WHERE id=?', [
    parent.user.familyId,
  ]);
  const result = await createPrize({ starCost: 1 });
  expect((await redeem(result.id)).status).toBe(201);
  await run("UPDATE users SET status='SUSPENDED' WHERE id=?", [child.user.id]);
  const second = await createPrize({ starCost: 1 });
  expect((await redeem(second.id)).status).toBe(403);
});

it('prize pictures persist through editing and redemption snapshots, with a safe catalogue only', async () => {
  await run("UPDATE users SET status='ACTIVE' WHERE id=?", [child.user.id]);
  const illustrated = await createPrize({ imageKey: 'storybook' });
  expect(illustrated.imageKey).toBe('storybook');
  const catalogue = await request(app).get('/rewards').set(auth(child));
  expect(catalogue.body.data.find((p: { id: string }) => p.id === illustrated.id).imageKey).toBe(
    'storybook',
  );
  await earn('picture-' + randomUUID());
  const pending = await redeem(illustrated.id);
  expect(pending.status).toBe(201);
  expect(pending.body.imageKey).toBe('storybook');
  const edited = await request(app)
    .patch('/parent/rewards/' + illustrated.id)
    .set(auth(parent))
    .send(prize({ imageKey: 'toy-set' }));
  expect(edited.status).toBe(200);
  expect(edited.body.imageKey).toBe('toy-set');
  const history = await request(app).get('/rewards/redemptions').set(auth(child));
  expect(history.body.data.find((p: { id: string }) => p.id === pending.body.id).imageKey).toBe(
    'storybook',
  );
  await request(app)
    .post('/rewards/redemptions/' + pending.body.id + '/cancel')
    .set(auth(child))
    .send({})
    .expect(200);
  await request(app)
    .post('/parent/rewards')
    .set(auth(parent))
    .send(prize({ imageKey: '../private' }))
    .expect(400);
});
