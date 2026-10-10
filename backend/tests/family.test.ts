import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { User } from '@wonderlab/shared';
import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';
process.env.JOB_WORKER_ENABLED = 'false';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Family tests require an isolated test database');
const { createApp } = await import('../src/app.js');
const { migrate } = await import('../src/db/migrate.js');
const { pool, run, rows } = await import('../src/db/pool.js');
const app = createApp();
const ids: string[] = [];
interface Tokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}
let parent: Tokens, other: Tokens, admin: Tokens, child: Tokens, familyId: string, planId: string;
const auth = (account: Tokens) => ({ Authorization: 'Bearer ' + account.accessToken });
const createParent = async () => {
  const response = await request(app)
    .post('/auth/parent/register')
    .send({
      name: 'Test Parent',
      familyName: 'Test Family',
      email: randomUUID() + '@example.com',
      password: 'FamilyPassword123!',
    });
  if (response.body.user) ids.push(response.body.user.id);
  expect(response.status).toBe(201);
  return response.body;
};
beforeAll(async () => {
  await migrate();
});
afterAll(async () => {
  for (const id of ids.reverse()) await run('DELETE FROM users WHERE id=?', [id]);
  if (planId) await run('DELETE FROM subscription_plans WHERE id=?', [planId]);
  await pool.end();
});
it('creates a single family workspace and separates login portals', async () => {
  parent = await createParent();
  other = await createParent();
  expect(parent.user.accountType).toBe('PARENT');
  familyId = parent.user.familyId;
  const dash = await request(app).get('/parent/dashboard').set(auth(parent));
  expect(dash.status).toBe(200);
  expect(dash.body.access.status).toBe('TRIALING');
  const wrong = await request(app)
    .post('/auth/admin/login')
    .send({ email: parent.user.email, password: 'FamilyPassword123!' });
  expect(wrong.status).toBe(401);
  admin = (
    await request(app)
      .post('/auth/register')
      .send({
        name: 'Test Admin',
        email: randomUUID() + '@example.com',
        password: 'FamilyPassword123!',
      })
  ).body;
  ids.push(admin.user.id);
  await run("UPDATE user_roles SET role_id='SUPER_ADMIN' WHERE user_id=?", [admin.user.id]);
  const plan = await request(app).post('/admin/plans').set(auth(admin)).send({
    name: 'Test Plan',
    description: 'Test',
    priceMonthlyCents: 2900,
    childLimit: 2,
    generationLimit: 2,
    trialDays: 14,
    isActive: true,
  });
  expect(plan.status).toBe(201);
  planId = plan.body.id;
});
it('enforces child ownership, passcodes, role and profile limits', async () => {
  const created = await request(app)
    .post('/parent/children')
    .set(auth(parent))
    .send({
      name: 'Alex Child',
      username: 'alex',
      passcode: 'qwer1234!',
      schoolLevel: 'Primary 4',
      canGenerate: true,
      allowedSubjects: ['MATHEMATICS'],
      dailyMinutesLimit: 5,
    });
  expect(created.status).toBe(201);
  ids.push(created.body.id);
  const dash = (await request(app).get('/parent/dashboard').set(auth(parent))).body;
  child = (
    await request(app)
      .post('/auth/child/login')
      .send({ familyCode: dash.family.code, username: 'alex', passcode: 'qwer1234!' })
  ).body;
  expect(child.user.accountType).toBe('CHILD');
  expect(
    (
      await request(app)
        .post('/auth/login')
        .send({
          email: (
            await rows<{ email: string }>('SELECT email FROM users WHERE id=?', [child.user.id])
          )[0].email,
          password: 'qwer1234!',
        })
    ).status,
  ).toBe(401);
  expect(
    (
      await request(app)
        .patch('/parent/children/' + child.user.id)
        .set(auth(other))
        .send({ status: 'SUSPENDED' })
    ).status,
  ).toBe(404);
  expect((await request(app).get('/parent/billing').set(auth(child))).status).toBe(403);
  expect(
    (
      await request(app)
        .patch('/admin/users/' + child.user.id)
        .set(auth(admin))
        .send({ role: 'ADMIN' })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/parent/children/' + child.user.id + '/passcode')
        .set(auth(parent))
        .send({ passcode: 'short' })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/parent/children/' + child.user.id + '/passcode')
        .set(auth(parent))
        .send({ passcode: 'Changed123!' })
    ).status,
  ).toBe(200);
  expect(
    (await request(app).post('/auth/refresh').send({ refreshToken: child.refreshToken })).status,
  ).toBe(401);
  expect((await request(app).get('/auth/me').set(auth(child))).status).toBe(401);
  child = (
    await request(app)
      .post('/auth/child/login')
      .send({ familyCode: dash.family.code, username: 'alex', passcode: 'Changed123!' })
  ).body;
});
it('reserves creation for parents even when a child has an old generation permission', async () => {
  await run('UPDATE family_children SET can_generate=TRUE WHERE user_id=?', [child.user.id]);
  expect((await request(app).get('/learning-access').set(auth(child))).body.canGenerate).toBe(
    false,
  );
  expect((await request(app).get('/learning-access').set(auth(parent))).body.canGenerate).toBe(
    true,
  );
  const input = {
    title: 'Parent managed maths',
    subject: 'MATHEMATICS',
    content: 'Fractions are equal parts of a whole.',
  };
  const before = (
    await rows<{ count: number }>('SELECT COUNT(*) count FROM generation_jobs WHERE family_id=?', [
      familyId,
    ])
  )[0].count;
  const generated = await request(app).post('/lessons/generate').set(auth(child)).send(input);
  expect(generated.status).toBe(403);
  expect(generated.body.error.code).toBe('GENERATION_RESTRICTED');
  expect((await request(app).post('/uploads').set(auth(child))).status).toBe(403);
  const id = randomUUID();
  await run(
    "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,'Old child maths','MATHEMATICS','English','Primary','READY','Fractions')",
    [id, child.user.id],
  );
  expect(
    (
      await request(app)
        .post('/lessons/' + id + '/regenerate')
        .set(auth(child))
    ).status,
  ).toBe(403);
  expect(
    (
      await rows<{ count: number }>(
        'SELECT COUNT(*) count FROM generation_jobs WHERE family_id=?',
        [familyId],
      )
    )[0].count,
  ).toBe(before);
});
it('keeps pending requests unpaid, applies admin trials and paid snapshots', async () => {
  const pending = await request(app)
    .post('/parent/subscriptions')
    .set(auth(parent))
    .send({ planId });
  expect(pending.status).toBe(201);
  expect(pending.body.status).toBe('PENDING');
  expect(
    (
      await request(app)
        .patch('/admin/families/' + familyId)
        .set(auth(admin))
        .send({ trialDays: 0 })
    ).status,
  ).toBe(200);
  expect((await request(app).get('/learning-access').set(auth(parent))).body.canLearn).toBe(false);
  const activated = await request(app)
    .post('/admin/subscriptions')
    .set(auth(admin))
    .send({ familyId, planId, periodDays: 30 });
  expect(activated.status).toBe(201);
  expect(activated.body.status).toBe('ACTIVE');
  await request(app)
    .patch('/admin/plans/' + planId)
    .set(auth(admin))
    .send({ generationLimit: 10, childLimit: 5 });
  const access = (await request(app).get('/learning-access').set(auth(parent))).body;
  expect(access.generationLimit).toBe(2);
  expect(access.childLimit).toBe(2);
  const extra = await request(app).post('/parent/children').set(auth(parent)).send({
    name: 'Second Child',
    username: 'second',
    passcode: 'qwer1234!',
    schoolLevel: 'Primary 4',
  });
  expect(extra.status).toBe(201);
  ids.push(extra.body.id);
  await request(app)
    .patch('/parent/children/' + extra.body.id)
    .set(auth(parent))
    .send({ status: 'SUSPENDED' });
  expect(
    (
      await request(app).post('/parent/children').set(auth(parent)).send({
        name: 'Third Child',
        username: 'third',
        passcode: 'qwer1234!',
        schoolLevel: 'Primary 4',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(app)
        .post('/parent/subscriptions/' + activated.body.id + '/cancel')
        .set(auth(other))
    ).status,
  ).toBe(404);
});
it('shares private lessons but enforces subjects, pauses and concurrent family quota', async () => {
  const input = {
    title: 'Maths',
    subject: 'MATHEMATICS',
    language: 'English',
    schoolLevel: 'Primary 4',
    inputType: 'TEXT',
    content: 'Fractions are equal parts of a whole. Learn how to compare fractions.',
  };
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      request(app).post('/lessons/generate').set(auth(parent)).send(input),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([202, 202, 429]);
  const id = results.find((r) => r.status === 202)!.body.lessonId;
  expect(
    (
      await rows<{ family_id: string }>('SELECT family_id FROM generation_jobs WHERE lesson_id=?', [
        id,
      ])
    )[0].family_id,
  ).toBe(familyId);
  expect(
    (
      await request(app)
        .get('/lessons/' + id)
        .set(auth(child))
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get('/lessons/' + id)
        .set(auth(other))
    ).status,
  ).toBe(404);
  const foreign = randomUUID();
  await run(
    "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,source_content,input_type) VALUES(?,?,'Science','SCIENCE','English','Primary','PRIVATE','science','TEXT')",
    [foreign, parent.user.id],
  );
  expect(
    (
      await request(app)
        .get('/lessons/' + foreign)
        .set(auth(child))
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .post('/lessons/generate')
        .set(auth(child))
        .send({ ...input, subject: 'SCIENCE' })
    ).status,
  ).toBe(403);
  await request(app)
    .patch('/parent/children/' + child.user.id)
    .set(auth(parent))
    .send({ status: 'SUSPENDED' });
  expect(
    (
      await request(app)
        .get('/lessons/' + id)
        .set(auth(child))
    ).status,
  ).toBe(403);
  await request(app)
    .patch('/parent/children/' + child.user.id)
    .set(auth(parent))
    .send({ status: 'ACTIVE' });
  expect(
    (await request(app).post('/learning-heartbeat').set(auth(child)).send({ elapsedSeconds: 300 }))
      .status,
  ).toBe(400);
  expect((await request(app).post('/learning-heartbeat').set(auth(child)).send({})).status).toBe(
    200,
  );
  await run(
    'UPDATE child_daily_usage SET heartbeat_at=UTC_TIMESTAMP(3)-INTERVAL 2 MINUTE WHERE child_id=?',
    [child.user.id],
  );
  const heartbeats = await Promise.all([
    request(app).post('/learning-heartbeat').set(auth(child)).send({}),
    request(app).post('/learning-heartbeat').set(auth(child)).send({}),
  ]);
  expect(heartbeats[1].body.learningSecondsToday).toBe(30);
  await run('UPDATE child_daily_usage SET learning_seconds=300 WHERE child_id=?', [child.user.id]);
  expect((await request(app).get('/learning-access').set(auth(child))).body.canLearn).toBe(false);
});
it('blocks child profile bypass, public sharing, uploads and cross-family job reads', async () => {
  const internal = (
    await rows<{ email: string }>('SELECT email FROM users WHERE id=?', [child.user.id])
  )[0].email;
  expect(
    (
      await request(app)
        .post('/auth/parent/login')
        .send({ email: internal, password: 'Changed123!' })
    ).status,
  ).toBe(401);
  expect(
    (
      await request(app)
        .patch('/auth/me')
        .set(auth(child))
        .send({ name: 'Bypass', timezone: 'UTC' })
    ).status,
  ).toBe(403);
  await run('UPDATE child_daily_usage SET learning_seconds=0 WHERE child_id=?', [child.user.id]);
  await request(app)
    .patch('/parent/children/' + child.user.id)
    .set(auth(parent))
    .send({ canGenerate: false });
  expect((await request(app).post('/uploads').set(auth(child))).status).toBe(403);
  const ownId = randomUUID();
  await run(
    "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,source_content) VALUES(?,?,'Child maths','MATHEMATICS','English','Primary','maths')",
    [ownId, child.user.id],
  );
  expect(
    (
      await request(app)
        .patch('/lessons/' + ownId)
        .set(auth(child))
        .send({ visibility: 'PUBLIC' })
    ).status,
  ).toBe(403);
  const [job] = await rows<{ id: string }>(
    'SELECT id FROM generation_jobs WHERE family_id=? LIMIT 1',
    [familyId],
  );
  expect(
    (
      await request(app)
        .get('/generation-jobs/' + job.id)
        .set(auth(other))
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get('/generation-jobs/' + job.id)
        .set(auth(child))
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get('/parent/children/' + child.user.id + '/progress')
        .set(auth(other))
    ).status,
  ).toBe(404);
});
it('accumulates fractions of seconds across rapid heartbeats', async () => {
  await run(
    'UPDATE child_daily_usage SET learning_seconds=0,heartbeat_at=UTC_TIMESTAMP(3)-INTERVAL 550000 MICROSECOND WHERE child_id=?',
    [child.user.id],
  );
  const first = await request(app).post('/learning-heartbeat').set(auth(child)).send({});
  expect(first.status).toBe(200);
  expect(first.body.learningSecondsToday).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const second = await request(app).post('/learning-heartbeat').set(auth(child)).send({});
  expect(second.body.learningSecondsToday).toBe(1);
});
it('filters effective subscription status and blocks expired and suspended family learning', async () => {
  const active = (await request(app).get('/parent/billing').set(auth(parent))).body.subscription;
  expect(
    (
      await request(app)
        .post(
          '/lessons/' +
            (
              await rows<{ lesson_id: string }>(
                'SELECT lesson_id FROM generation_jobs WHERE family_id=? LIMIT 1',
                [familyId],
              )
            )[0].lesson_id +
            '/regenerate',
        )
        .set(auth(parent))
    ).status,
  ).toBe(429);
  await run(
    'UPDATE family_subscriptions SET ends_at=UTC_TIMESTAMP(3)-INTERVAL 1 SECOND WHERE id=?',
    [active.id],
  );
  const expired = await request(app)
    .get('/admin/subscriptions?status=EXPIRED&pageSize=1')
    .set(auth(admin));
  expect(expired.status).toBe(200);
  expect(
    (await request(app).get('/admin/subscriptions?status=ACTIVE').set(auth(admin))).body.data.every(
      (s: { status: string }) => s.status === 'ACTIVE',
    ),
  ).toBe(true);
  expect(expired.body.data.every((s: { status: string }) => s.status === 'EXPIRED')).toBe(true);
  expect((await request(app).get('/learning-access').set(auth(parent))).body.status).toBe(
    'EXPIRED',
  );
  expect((await request(app).post('/learning-heartbeat').set(auth(child)).send({})).status).toBe(
    403,
  );
  await request(app)
    .patch('/admin/families/' + familyId)
    .set(auth(admin))
    .send({ trialDays: 1 });
  expect((await request(app).get('/learning-access').set(auth(child))).body.canLearn).toBe(true);
  await request(app)
    .patch('/admin/families/' + familyId)
    .set(auth(admin))
    .send({ status: 'SUSPENDED' });
  expect((await request(app).get('/learning-access').set(auth(child))).body.status).toBe(
    'SUSPENDED',
  );
  expect((await request(app).get('/lessons').set(auth(child))).status).toBe(403);
  await request(app)
    .patch('/admin/families/' + familyId)
    .set(auth(admin))
    .send({ status: 'ACTIVE' });
  await request(app)
    .patch('/admin/users/' + parent.user.id)
    .set(auth(admin))
    .send({ status: 'SUSPENDED' });
  expect((await request(app).get('/learning-access').set(auth(child))).body.status).toBe(
    'SUSPENDED',
  );
  await request(app)
    .patch('/admin/users/' + parent.user.id)
    .set(auth(admin))
    .send({ status: 'ACTIVE' });
  const activated = await request(app)
    .post('/admin/subscriptions')
    .set(auth(admin))
    .send({ familyId, planId, periodDays: 30 });
  await request(app)
    .patch('/admin/families/' + familyId)
    .set(auth(admin))
    .send({ trialDays: 0 });
  expect(
    (
      await request(app)
        .post('/parent/subscriptions/' + activated.body.id + '/cancel')
        .set(auth(parent))
    ).status,
  ).toBe(200);
  expect((await request(app).get('/learning-access').set(auth(parent))).body.canLearn).toBe(false);
  expect(
    (
      await request(app)
        .patch('/admin/families/' + familyId)
        .set(auth(parent))
        .send({ trialDays: 14 })
    ).status,
  ).toBe(403);
  for (const trialDays of [-1, 366])
    expect(
      (
        await request(app)
          .patch('/admin/families/' + familyId)
          .set(auth(admin))
          .send({ trialDays })
      ).status,
    ).toBe(400);
});

it('serializes the last family credit across parent generation and parent regeneration', async () => {
  const raceParent = await createParent();
  const raceFamily = (await request(app).get('/parent/dashboard').set(auth(raceParent))).body
    .family;
  const created = await request(app).post('/parent/children').set(auth(raceParent)).send({
    name: 'Race Child',
    username: 'racer',
    passcode: 'qwer1234!',
    schoolLevel: 'Primary 4',
    canGenerate: true,
  });
  expect(created.status).toBe(201);
  ids.push(created.body.id);
  await request(app)
    .patch('/admin/plans/' + planId)
    .set(auth(admin))
    .send({ generationLimit: 1 });
  await request(app)
    .post('/admin/subscriptions')
    .set(auth(admin))
    .send({ familyId: raceFamily.id, planId, periodDays: 30 });
  const id = randomUUID();
  await run(
    "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,'Race maths','MATHEMATICS','English','Primary','READY','Fractions are parts of a whole.')",
    [id, raceParent.user.id],
  );
  const blocker = await pool.getConnection();
  await blocker.beginTransaction();
  await rows('SELECT id FROM families WHERE id=? FOR UPDATE', [raceFamily.id], blocker);
  const generation = request(app)
    .post('/lessons/generate')
    .set(auth(raceParent))
    .send({
      title: 'Race',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    })
    .then((r) => r);
  const regeneration = request(app)
    .post('/lessons/' + id + '/regenerate')
    .set(auth(raceParent))
    .send({})
    .then((r) => r);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await blocker.commit();
  blocker.release();
  const responses = await Promise.all([generation, regeneration]);
  expect(responses.map((r) => r.status).sort()).toEqual([202, 429]);
  expect(
    (
      await rows<{ count: number }>(
        'SELECT COUNT(*) count FROM generation_jobs WHERE family_id=?',
        [raceFamily.id],
      )
    )[0].count,
  ).toBe(1);
});
it('keeps shared lesson progress individual and duplication free of AI credits', async () => {
  const { transaction } = await import('../src/db/pool.js');
  const { saveDefinition } = await import('../src/services/lessons.js');
  await request(app)
    .patch('/admin/families/' + familyId)
    .set(auth(admin))
    .send({ trialDays: 1 });
  const dashboard = (await request(app).get('/parent/dashboard').set(auth(parent))).body;
  const second = dashboard.children.find((c: { username: string }) => c.username === 'second');
  await request(app)
    .patch('/parent/children/' + second.id)
    .set(auth(parent))
    .send({ status: 'ACTIVE' });
  const sibling = (
    await request(app)
      .post('/auth/child/login')
      .send({ familyCode: dashboard.family.code, username: 'second', passcode: 'qwer1234!' })
  ).body;
  const id = randomUUID();
  await transaction(async (db) => {
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,'Family numbers','MATHEMATICS','English','Primary','READY','Addition')",
      [id, parent.user.id],
      db,
    );
    await saveDefinition(
      id,
      {
        lessonSchemaVersion: 1,
        title: 'Family numbers',
        subject: 'MATHEMATICS',
        language: 'English',
        objectives: ['Add numbers'],
        scenes: [
          {
            id: 'numbers',
            type: 'NUMBER_GAME',
            title: 'Add',
            explanation: 'Add numbers',
            rounds: [
              { id: 'r1', left: 2, right: 3, operation: 'ADD' },
              { id: 'r2', left: 4, right: 2, operation: 'SUBTRACT' },
            ],
          },
        ],
      },
      db,
    );
  });
  expect(
    (
      await request(app)
        .get('/lessons/' + id)
        .set(auth(child))
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post('/lessons/' + id + '/progress')
        .set(auth(child))
        .send({
          sceneId: 'numbers',
          result: {
            roundAnswers: [
              { roundId: 'r1', value: 5 },
              { roundId: 'r2', value: 2 },
            ],
          },
          elapsedSeconds: 600,
        })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get('/lessons/' + id + '/progress')
        .set(auth(child))
    ).body.progress,
  ).toBe(100);
  expect(
    (
      await request(app)
        .get('/lessons/' + id + '/progress')
        .set(auth(sibling))
    ).body.progress,
  ).toBe(0);
  expect(
    (
      await request(app)
        .get('/parent/children/' + child.user.id + '/progress')
        .set(auth(parent))
    ).body.completed,
  ).toBe(1);
  expect(
    (await request(app).get('/learning-access').set(auth(child))).body.learningSecondsToday,
  ).toBe(1);
  const before = (await request(app).get('/learning-access').set(auth(child))).body.generationUsed;
  expect(
    (
      await request(app)
        .post('/lessons/' + id + '/duplicate')
        .set(auth(child))
    ).status,
  ).toBe(201);
  expect((await request(app).get('/learning-access').set(auth(child))).body.generationUsed).toBe(
    before,
  );
});
it('counts concurrent child creation under the family lock', async () => {
  const raceParent = await createParent();
  const responses = await Promise.all(
    ['one', 'two', 'three'].map((username) =>
      request(app).post('/parent/children').set(auth(raceParent)).send({
        name: 'Concurrent Child',
        username,
        passcode: 'qwer1234!',
        schoolLevel: 'Primary 4',
      }),
    ),
  );
  for (const response of responses) if (response.body.id) ids.push(response.body.id);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 201, 409]);
});
it('fails closed for child accounts whose family has been removed', async () => {
  const temporaryParent = await createParent();
  const dashboard = (await request(app).get('/parent/dashboard').set(auth(temporaryParent))).body;
  const created = await request(app).post('/parent/children').set(auth(temporaryParent)).send({
    name: 'Orphan Child',
    username: 'orphan',
    passcode: 'qwer1234!',
    schoolLevel: 'Primary 4',
  });
  expect(created.status).toBe(201);
  ids.push(created.body.id);
  const orphan = (
    await request(app)
      .post('/auth/child/login')
      .send({ familyCode: dashboard.family.code, username: 'orphan', passcode: 'qwer1234!' })
  ).body;
  const email = (
    await rows<{ email: string }>('SELECT email FROM users WHERE id=?', [orphan.user.id])
  )[0].email;
  await run('DELETE FROM users WHERE id=?', [temporaryParent.user.id]);
  expect((await request(app).get('/learning-access').set(auth(orphan))).body.canLearn).toBe(false);
  expect(
    (await request(app).post('/auth/login').send({ email, password: 'qwer1234!' })).status,
  ).toBe(401);
});
it('locks only the current family while reserving credits', async () => {
  const { familyForUser } = await import('../src/services/family.js');
  const a = await pool.getConnection(),
    b = await pool.getConnection();
  try {
    await a.beginTransaction();
    await b.beginTransaction();
    await familyForUser(parent.user.id, a, true);
    const unrelated = await rows(
      'SELECT id FROM families WHERE id=? FOR UPDATE NOWAIT',
      [other.user.familyId],
      b,
    );
    expect(unrelated).toHaveLength(1);
  } finally {
    await a.rollback();
    await b.rollback();
    a.release();
    b.release();
  }
});
it('reserves internal child email addresses from public registration', async () => {
  expect(
    (
      await request(app)
        .post('/auth/register')
        .send({
          name: 'Reserved Address',
          email: randomUUID() + '@child.wonderlab.invalid',
          password: 'FamilyPassword123!',
        })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post('/auth/parent/register')
        .send({
          name: 'Reserved Parent',
          familyName: 'Reserved Family',
          email: randomUUID() + '@child.wonderlab.invalid',
          password: 'FamilyPassword123!',
        })
    ).status,
  ).toBe(400);
});

it('lets an administrator repair an old child-owned lesson using the parent family allowance', async () => {
  const repairParent = await createParent();
  const created = await request(app).post('/parent/children').set(auth(repairParent)).send({
    name: 'Repair Child',
    username: 'repair',
    passcode: 'qwer1234!',
    schoolLevel: 'Primary 4',
  });
  expect(created.status).toBe(201);
  ids.push(created.body.id);
  const id = randomUUID();
  await run(
    "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,'Old fractions','MATHEMATICS','English','Primary','READY','Fractions are equal parts of a whole.')",
    [id, created.body.id],
  );
  const repaired = await request(app)
    .post('/admin/lessons/' + id + '/regenerate')
    .set(auth(admin));
  expect(repaired.status).toBe(202);
  const [job] = await rows<{ family_id: string }>(
    'SELECT family_id FROM generation_jobs WHERE id=?',
    [repaired.body.jobId],
  );
  expect(job.family_id).toBe(repairParent.user.familyId);
});

it('lets parents select lesson grades and blocks all child access paths before awarding progress', async () => {
  const gradeParent = await createParent();
  const foreignParent = await createParent();
  const profile = await request(app)
    .post('/parent/children')
    .set(auth(gradeParent))
    .send({
      name: 'Grade Child',
      username: 'grades',
      passcode: 'Grade123!',
      schoolLevel: 'Primary 2',
      allowedSubjects: ['MATHEMATICS'],
    });
  expect(profile.status).toBe(201);
  ids.push(profile.body.id);
  expect(profile.body.allowedSchoolLevels).toBeNull();
  const dash = (await request(app).get('/parent/dashboard').set(auth(gradeParent))).body;
  const learner: Tokens = (
    await request(app).post('/auth/child/login').send({
      familyCode: dash.family.code,
      username: 'grades',
      passcode: 'Grade123!',
    })
  ).body;
  const { transaction } = await import('../src/db/pool.js');
  const { saveDefinition } = await import('../src/services/lessons.js');
  const lessonIds: Record<string, string> = {};
  for (const schoolLevel of [
    'Primary 2',
    'Primary 5',
    'Primary 1–3',
    'Primary school',
    'Secondary 1–3',
    'Unspecified',
  ]) {
    const id = randomUUID();
    lessonIds[schoolLevel] = id;
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content) VALUES(?,?,'Grade fixture','MATHEMATICS','English',?,'PUBLIC','READY','Numbers')",
      [id, gradeParent.user.id, schoolLevel],
    );
    await transaction((db) =>
      saveDefinition(
        id,
        {
          lessonSchemaVersion: 1,
          title: 'Grade fixture',
          subject: 'MATHEMATICS',
          language: 'English',
          objectives: ['Learn numbers'],
          scenes: [
            {
              id: 'numbers',
              type: 'FLASHCARD',
              title: 'Numbers',
              explanation: 'Learn numbers',
              cards: [{ id: 'one', front: '1', back: 'One' }],
            },
          ],
        },
        db,
      ),
    );
  }
  expect(
    (
      await request(app)
        .get('/lessons/' + lessonIds['Primary 5'])
        .set(auth(learner))
    ).status,
  ).toBe(200);
  const changed = await request(app)
    .patch('/parent/children/' + learner.user.id)
    .set(auth(gradeParent))
    .send({ allowedSchoolLevels: ['Primary 2', 'Secondary 2'] });
  expect(changed.status).toBe(200);
  expect(changed.body.allowedSchoolLevels).toEqual(['Primary 2', 'Secondary 2']);
  expect(
    (await request(app).get('/learning-access').set(auth(learner))).body.allowedSchoolLevels,
  ).toEqual(['Primary 2', 'Secondary 2']);
  expect(
    (
      await request(app)
        .patch('/parent/children/' + learner.user.id)
        .set(auth(learner))
        .send({ allowedSchoolLevels: null })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch('/parent/children/' + learner.user.id)
        .set(auth(foreignParent))
        .send({ allowedSchoolLevels: null })
    ).status,
  ).toBe(404);
  const allowed = ['Primary 2', 'Primary 1–3', 'Primary school', 'Secondary 1–3'].map(
    (level) => lessonIds[level],
  );
  for (const path of ['/library', '/lessons']) {
    const listing = await request(app)
      .get(path + '?search=Grade%20fixture&pageSize=2')
      .set(auth(learner));
    expect(listing.status).toBe(200);
    expect(listing.body.total).toBe(4);
    expect(listing.body.data).toHaveLength(2);
    expect(listing.body.data.every((lesson: { id: string }) => allowed.includes(lesson.id))).toBe(
      true,
    );
  }
  const dashboard = (await request(app).get('/dashboard').set(auth(learner))).body;
  for (const lesson of [...dashboard.recent, ...dashboard.recommended])
    expect([lessonIds['Primary 5'], lessonIds.Unspecified]).not.toContain(lesson.id);
  const blocked = lessonIds['Primary 5'];
  for (const path of ['/lessons/' + blocked, '/lessons/' + blocked + '/progress']) {
    const response = await request(app).get(path).set(auth(learner));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('GRADE_RESTRICTED');
  }
  for (const [suffix, body] of [
    ['duplicate', {}],
    ['progress', { sceneId: 'numbers', result: { viewed: true } }],
    ['quiz/check', { sceneId: 'quiz', questionId: 'q', optionId: 'a' }],
    ['quiz/submit', { sceneId: 'quiz', answers: [{ questionId: 'q', optionId: 'a' }] }],
  ] as const) {
    const response = await request(app)
      .post('/lessons/' + blocked + '/' + suffix)
      .set(auth(learner))
      .send(body);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('GRADE_RESTRICTED');
  }
  expect(
    (
      await request(app)
        .get('/lessons/' + lessonIds.Unspecified)
        .set(auth(learner))
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get('/lessons/' + blocked)
        .set(auth(gradeParent))
    ).status,
  ).toBe(200);
  expect(
    (
      await rows<{ count: number }>('SELECT COUNT(*) count FROM lesson_progress WHERE user_id=?', [
        learner.user.id,
      ])
    )[0].count,
  ).toBe(0);
  await request(app)
    .patch('/parent/children/' + learner.user.id)
    .set(auth(gradeParent))
    .send({ status: 'SUSPENDED' });
  const resumed = await request(app)
    .patch('/parent/children/' + learner.user.id)
    .set(auth(gradeParent))
    .send({ status: 'ACTIVE' });
  expect(resumed.body.allowedSchoolLevels).toEqual(['Primary 2', 'Secondary 2']);
  await request(app)
    .patch('/parent/children/' + learner.user.id)
    .set(auth(gradeParent))
    .send({ allowedSchoolLevels: null });
  expect(
    (
      await request(app)
        .get('/lessons/' + blocked)
        .set(auth(learner))
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .get('/lessons/' + lessonIds.Unspecified)
        .set(auth(learner))
    ).status,
  ).toBe(200);
});
