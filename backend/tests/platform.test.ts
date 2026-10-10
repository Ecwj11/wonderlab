import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
// Unit/integration fixtures never consume the application's real-provider budget.
process.env.AI_PROVIDER = 'mock';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Integration tests require a database ending in _test');
const { createApp } = await import('../src/app.js');
const { migrate } = await import('../src/db/migrate.js');
const { seed } = await import('../src/db/seed.js');
const { pool, rows, run } = await import('../src/db/pool.js');
const { processNextJob } = await import('../src/services/jobs.js');
const providerModule = await import('../src/providers/index.js');
const { MockAIProvider } = await import('../src/providers/mock.js');
const { config } = await import('../src/config.js');
const app = createApp();
let token = '';
let refresh = '';
let userId = '';
let lessonId = '';
let jobId = '';
beforeAll(async () => {
  await migrate();
  await seed();
  await run('DELETE FROM generation_jobs');
  await run('DELETE FROM lessons WHERE user_id=? AND id NOT IN (?,?,?,?)', [
    '10000000-0000-4000-8000-000000000001',
    ...Array.from(
      { length: 4 },
      (_, i) => '30000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
    ),
  ]);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: 'student@example.com', password: 'qwer1234!' });
  expect(login.status).toBe(200);
  token = login.body.accessToken;
  refresh = login.body.refreshToken;
  userId = login.body.user.id;
});
afterAll(async () => {
  await pool.end();
});
const auth = () => ({ Authorization: `Bearer ${token}` });
it('validates every game mission and awards completion XP once', async () => {
  const { saveDefinition, listLessons } = await import('../src/services/lessons.js');
  const { transaction } = await import('../src/db/pool.js');
  const id = randomUUID();
  await transaction(async (db) => {
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,?,'MATHEMATICS','English','Primary 1','READY',?)",
      [id, userId, 'Playable blocks', 'Addition practice'],
      db,
    );
    await saveDefinition(
      id,
      {
        lessonSchemaVersion: 1,
        title: 'Playable blocks',
        subject: 'MATHEMATICS',
        language: 'English',
        objectives: ['Add and subtract'],
        scenes: [
          {
            id: 'blocks',
            type: 'NUMBER_GAME',
            title: 'Blocks',
            explanation: 'Build',
            rounds: [
              { id: 'r1', left: 2, right: 3, operation: 'ADD' },
              { id: 'r2', left: 7, right: 2, operation: 'SUBTRACT' },
            ],
          },
          {
            id: 'memory',
            type: 'MATCHING',
            title: 'Pairs',
            explanation: 'Match',
            pairs: [
              { id: 'p1', left: '2 + 3', right: '5' },
              { id: 'p2', left: '1 + 2', right: '3' },
            ],
          },
        ],
      },
      db,
    );
  });
  try {
    expect(
      (await listLessons(userId, { status: 'READY', search: 'Playable blocks' })).data.map(
        (lesson) => lesson.id,
      ),
    ).toContain(id);
    const post = (sceneId: string, result: unknown) =>
      request(app)
        .post('/lessons/' + id + '/progress')
        .set(auth())
        .send({ sceneId, result });
    for (const result of [
      { viewed: true, xp: 9999 },
      { roundAnswers: [{ roundId: 'r1', value: 5 }] },
      {
        roundAnswers: [
          { roundId: 'r1', value: 5 },
          { roundId: 'r1', value: 5 },
        ],
      },
      {
        roundAnswers: [
          { roundId: 'r1', value: 5 },
          { roundId: 'r2', value: 9 },
        ],
      },
    ])
      expect((await post('blocks', result)).status).toBe(400);
    expect(
      (
        await post('blocks', {
          roundAnswers: [
            { roundId: 'r1', value: 5 },
            { roundId: 'r2', value: 5 },
          ],
        })
      ).body.progress,
    ).toBe(50);
    expect(
      (await listLessons(userId, { status: 'READY', search: 'Playable blocks' })).data,
    ).toHaveLength(0);
    expect(
      (await listLessons(userId, { status: 'IN_PROGRESS', search: 'Playable blocks' })).data.map(
        (lesson) => lesson.id,
      ),
    ).toContain(id);
    for (const result of [
      { viewed: true },
      { matchedIds: ['p1'] },
      { matchedIds: ['p1', 'p1'] },
      { matchedIds: ['p1', 'unknown'] },
    ])
      expect((await post('memory', result)).status).toBe(400);
    const completed = await post('memory', { matchedIds: ['p2', 'p1'], coins: 999999 });
    expect(completed.status).toBe(200);
    expect(completed.body).toMatchObject({ lessonCompleted: true, xpEarned: 50, progress: 100 });
    expect(
      (await listLessons(userId, { status: 'COMPLETED', search: 'Playable blocks' })).data.map(
        (lesson) => lesson.id,
      ),
    ).toContain(id);
    const replay = await post('memory', { matchedIds: ['p1', 'p2'] });
    expect(replay.body.xpEarned).toBe(0);
    expect(
      (
        await rows<{ count: number }>(
          'SELECT COUNT(*) count FROM user_xp_transactions WHERE user_id=? AND reward_key=?',
          [userId, 'complete:' + id],
        )
      )[0].count,
    ).toBe(1);
  } finally {
    await run('DELETE FROM lessons WHERE id=?', [id]);
  }
});
it('separates unavailable Codex usage from reported provider totals', async () => {
  const login = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@example.com', password: 'qwer1234!' });
  const header = { Authorization: `Bearer ${login.body.accessToken}` };
  const before = (await request(app).get('/admin/dashboard').set(header)).body.usage;
  const ids = [randomUUID(), randomUUID()];
  try {
    await run(
      'INSERT INTO ai_usage(id,user_id,provider,tokens_input,tokens_output,estimated_cost) VALUES(?,?,?,?,?,?),(?,?,?,?,?,?)',
      [ids[0], userId, 'codex', 0, 0, 0, ids[1], userId, 'openai', 4, 6, 0.002],
    );
    const after = (await request(app).get('/admin/dashboard').set(header)).body.usage;
    expect(after.unreportedRecords).toBe(Number(before.unreportedRecords || 0) + 1);
    expect(after.reportedRecords).toBe(Number(before.reportedRecords || 0) + 1);
    expect(after.tokens).toBe(Number(before.tokens) + 10);
    expect(after.cost).toBeCloseTo(Number(before.cost) + 0.002, 6);
  } finally {
    await run('DELETE FROM ai_usage WHERE id IN (?,?)', ids);
  }
});
it('rejects unconfigured real generation before creating jobs or resetting progress', async () => {
  const originalProvider = config.AI_PROVIDER;
  const originalKey = config.OPENAI_API_KEY;
  const id = '30000000-0000-4000-8000-000000000001';
  const before = (
    await request(app)
      .get('/lessons/' + id)
      .set(auth())
  ).body;
  const [countBefore] = await rows<{ count: number }>('SELECT COUNT(*) count FROM generation_jobs');
  config.AI_PROVIDER = 'openai';
  config.OPENAI_API_KEY = '';
  try {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Real fractions',
      subject: 'MATHEMATICS',
      language: 'English',
      schoolLevel: 'Primary 4',
      content: 'Fractions are equal parts of a whole.',
      inputType: 'TEXT',
    });
    expect(generated.status).toBe(503);
    expect(generated.body.error.code).toBe('AI_NOT_CONFIGURED');
    const regenerated = await request(app)
      .post('/lessons/' + id + '/regenerate')
      .set(auth());
    expect(regenerated.status).toBe(503);
    expect(
      (await rows<{ count: number }>('SELECT COUNT(*) count FROM generation_jobs'))[0].count,
    ).toBe(countBefore.count);
    expect(
      (
        await request(app)
          .get('/lessons/' + id)
          .set(auth())
      ).body,
    ).toEqual(before);
  } finally {
    config.AI_PROVIDER = originalProvider;
    config.OPENAI_API_KEY = originalKey;
  }
});
describe('Student portal templates', () => {
  let adminToken = '';
  let original: unknown;
  beforeAll(async () => {
    const login = await request(app).post('/auth/login').send({
      email: 'admin@example.com',
      password: 'qwer1234!',
    });
    adminToken = login.body.accessToken;
    original = (
      await rows<{ value: unknown }>("SELECT value FROM system_settings WHERE id='appearance'")
    )[0]?.value;
    await run("DELETE FROM system_settings WHERE id='appearance'");
  });
  afterAll(async () => {
    await run("DELETE FROM system_settings WHERE id='appearance'");
    if (original !== undefined)
      await run("INSERT INTO system_settings(id,value) VALUES('appearance',?)", [
        typeof original === 'string' ? original : JSON.stringify(original),
      ]);
  });
  it('defaults existing installations to playground without exposing private settings', async () => {
    const response = await request(app).get('/appearance').set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ template: 'playground' });
    expect((await request(app).get('/appearance')).status).toBe(401);
  });
  it('allows students to read templates but only administrators to change them', async () => {
    expect(
      (await request(app).patch('/admin/appearance').set(auth()).send({ template: 'space' }))
        .status,
    ).toBe(403);
    expect(
      (await request(app).patch('/appearance').set(auth()).send({ template: 'space' })).status,
    ).toBe(404);
  });
  it('persists every supported template for all students without changing learning defaults', async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };
    const defaults = (await request(app).get('/admin/settings').set(headers)).body;
    for (const template of ['space', 'clay', 'playground']) {
      const saved = await request(app).patch('/admin/appearance').set(headers).send({ template });
      expect(saved.status).toBe(200);
      expect(saved.body).toEqual({ template });
      expect((await request(app).get('/appearance').set(auth())).body).toEqual({ template });
      expect((await request(app).get('/admin/appearance').set(headers)).body).toEqual({ template });
    }
    expect((await request(app).get('/admin/settings').set(headers)).body).toEqual(defaults);
  });
  it('rejects arbitrary templates, injected styles and extra fields without changing the saved template', async () => {
    const headers = { Authorization: `Bearer ${adminToken}` };
    for (const body of [
      { template: 'unknown' },
      { template: '<script>alert(1)</script>' },
      { template: 'space', css: 'body{}' },
      {},
    ]) {
      expect((await request(app).patch('/admin/appearance').set(headers).send(body)).status).toBe(
        400,
      );
    }
    expect((await request(app).get('/appearance').set(auth())).body).toEqual({
      template: 'playground',
    });
  });
});
describe('Complete learning vertical slice', () => {
  it('authenticates and refuses password leaks', async () => {
    const me = await request(app).get('/auth/me').set(auth());
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('student@example.com');
    expect(me.body.password_hash).toBeUndefined();
  });
  it('blocks unauthenticated and student admin access', async () => {
    expect((await request(app).get('/lessons')).status).toBe(401);
    expect((await request(app).get('/admin/users').set(auth())).status).toBe(403);
  });
  it('rejects invalid generation inputs', async () => {
    expect(
      (
        await request(app)
          .post('/lessons/generate')
          .set(auth())
          .send({ title: 'x', content: 'fractions', subject: 'SCRIPT' })
      ).status,
    ).toBe(400);
  });
  it('returns a pending job without blocking generation', async () => {
    const r = await request(app)
      .post('/lessons/generate')
      .set(auth())
      .send({
        title: 'Fractions ' + randomUUID(),
        subject: 'MATHEMATICS',
        language: 'English',
        schoolLevel: 'Primary 4',
        content: 'Fractions are equal parts of a whole. One quarter is one of four equal slices.',
      });
    expect(r.status).toBe(202);
    lessonId = r.body.lessonId;
    jobId = r.body.jobId;
    const j = await request(app)
      .get('/generation-jobs/' + jobId)
      .set(auth());
    expect(j.body.status).toBe('PENDING');
  });
  it('durably generates a validated playable lesson without AI keys', async () => {
    await processNextJob(0);
    const j = await request(app)
      .get('/generation-jobs/' + jobId)
      .set(auth());
    expect(j.body.status).toBe('COMPLETED');
    const lesson = await request(app)
      .get('/lessons/' + lessonId)
      .set(auth());
    expect(lesson.body.definition.lessonSchemaVersion).toBe(1);
    expect(lesson.body.definition.scenes[0].type).toBe('FRACTION_PIZZA');
    expect(JSON.stringify(lesson.body.definition)).not.toContain('correctOptionId');
  });
  it('rejects unverified fraction completion', async () => {
    const r = await request(app)
      .post('/lessons/' + lessonId + '/progress')
      .set(auth())
      .send({ sceneId: 'pizza', result: { parts: 4, selected: 3 }, elapsedSeconds: 30 });
    expect(r.status).toBe(400);
  });
  it('persists verified fraction and exploration completion', async () => {
    const a = await request(app)
      .post('/lessons/' + lessonId + '/progress')
      .set(auth())
      .send({ sceneId: 'pizza', result: { parts: 4, selected: 1 }, elapsedSeconds: 30 });
    expect(a.status).toBe(200);
    const b = await request(app)
      .post('/lessons/' + lessonId + '/progress')
      .set(auth())
      .send({
        sceneId: 'fractions-review',
        result: { viewedIds: ['numerator', 'denominator'] },
        elapsedSeconds: 20,
      });
    expect(b.status).toBe(200);
  });
  it('scores on the server and awards completion XP exactly once', async () => {
    const payload = {
      sceneId: 'fractions-quiz',
      answers: [
        { questionId: 'q1', optionId: 'a' },
        { questionId: 'q2', optionId: 'b' },
        { questionId: 'q3', optionId: 'c' },
      ],
    };
    const before = await request(app).get('/auth/me').set(auth());
    const first = await request(app)
      .post('/lessons/' + lessonId + '/quiz/submit')
      .set(auth())
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body.score).toBe(100);
    expect(first.body.xpEarned).toBe(130);
    expect(first.body.lessonCompleted).toBe(true);
    const again = await request(app)
      .post('/lessons/' + lessonId + '/quiz/submit')
      .set(auth())
      .send(payload);
    expect(again.body.alreadySubmitted).toBe(true);
    const after = await request(app).get('/auth/me').set(auth());
    expect(after.body.xp - before.body.xp).toBe(130);
    const progress = await request(app)
      .get('/lessons/' + lessonId + '/progress')
      .set(auth());
    expect(progress.body.progress).toBe(100);
  });
  it('enforces lesson/job ownership', async () => {
    const other = await request(app)
      .post('/auth/register')
      .send({
        name: 'Other student',
        email: randomUUID() + '@example.com',
        password: 'SafePassword123!',
      });
    const header = { Authorization: `Bearer ${other.body.accessToken}` };
    expect(
      (
        await request(app)
          .get('/lessons/' + lessonId)
          .set(header)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get('/generation-jobs/' + jobId)
          .set(header)
      ).status,
    ).toBe(404);
  });
  it('rotates refresh tokens and rejects reused tokens', async () => {
    const r = await request(app).post('/auth/refresh').send({ refreshToken: refresh });
    expect(r.status).toBe(200);
    expect(r.body.refreshToken).not.toBe(refresh);
    expect((await request(app).post('/auth/refresh').send({ refreshToken: refresh })).status).toBe(
      401,
    );
  });
  it('invalidates existing access tokens when an account is suspended', async () => {
    await run('UPDATE users SET status=? WHERE id=?', ['SUSPENDED', userId]);
    expect((await request(app).get('/auth/me').set(auth())).status).toBe(401);
    await run('UPDATE users SET status=? WHERE id=?', ['ACTIVE', userId]);
  });
  it('recovers an interrupted job from its durable lease', async () => {
    const r = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Recovery fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    expect(r.status).toBe(202);
    await run(
      "UPDATE generation_jobs SET status='PROCESSING',attempts=1,heartbeat_at=UTC_TIMESTAMP()-INTERVAL 10 MINUTE WHERE id=?",
      [r.body.jobId],
    );
    await processNextJob(0);
    const job = await request(app)
      .get('/generation-jobs/' + r.body.jobId)
      .set(auth());
    expect(job.body.status).toBe('COMPLETED');
  });
  it('accounts for known agent usage when the third worker attempt expires', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Exhausted retry fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    expect(generated.status).toBe(202);
    for (const [attempt, tokens, status] of [
      [1, 100, 'COMPLETED'],
      [2, 50, 'COMPLETED'],
      [3, 0, 'PROCESSING'],
    ] as const) {
      await run(
        'INSERT INTO generation_agent_tasks(id,job_id,attempt,task_order,role,name,status,provider,model,tokens_input,tokens_output,estimated_cost) VALUES(?,?,?,0,?,?,?,?,?,?,?,?)',
        [
          randomUUID(),
          generated.body.jobId,
          attempt,
          'ANALYST',
          'Learning analyst',
          status,
          'mock',
          'wonderlab-demo-v1',
          tokens,
          tokens * 2,
          tokens * 0.0002,
        ],
      );
    }
    await run(
      "UPDATE generation_jobs SET status='PROCESSING',attempts=3,heartbeat_at=UTC_TIMESTAMP()-INTERVAL 10 MINUTE WHERE id=?",
      [generated.body.jobId],
    );
    await Promise.all([processNextJob(0), processNextJob(0)]);
    await processNextJob(0);
    const [job] = await rows<{
      status: string;
      completed_at: string | null;
      tokens_input: number;
      tokens_output: number;
      estimated_cost: number;
    }>(
      'SELECT status,completed_at,tokens_input,tokens_output,estimated_cost FROM generation_jobs WHERE id=?',
      [generated.body.jobId],
    );
    expect(job.status).toBe('FAILED');
    expect(job.completed_at).not.toBeNull();
    expect(job.tokens_input).toBe(150);
    expect(job.tokens_output).toBe(300);
    expect(job.estimated_cost).toBeCloseTo(0.03);
    const usage = await rows<{
      tokens_input: number;
      tokens_output: number;
      estimated_cost: number;
    }>('SELECT tokens_input,tokens_output,estimated_cost FROM ai_usage WHERE job_id=?', [
      generated.body.jobId,
    ]);
    expect(usage).toHaveLength(1);
    expect(usage[0].tokens_input).toBe(150);
    expect(usage[0].tokens_output).toBe(300);
    expect(usage[0].estimated_cost).toBeCloseTo(0.03);
    const detail = await request(app)
      .get('/generation-jobs/' + generated.body.jobId)
      .set(auth());
    expect(detail.body.agents[0].status).toBe('CANCELLED');
    const [lesson] = await rows<{ status: string }>('SELECT status FROM lessons WHERE id=?', [
      generated.body.lessonId,
    ]);
    expect(lesson.status).toBe('FAILED');
  });
  it('rejects duplicate question IDs and forged correct answers', async () => {
    const r = await request(app)
      .post('/lessons/' + lessonId + '/quiz/submit')
      .set(auth())
      .send({
        sceneId: 'fractions-quiz',
        answers: [
          { questionId: 'q1', optionId: 'a' },
          { questionId: 'q1', optionId: 'a' },
          { questionId: 'q1', optionId: 'a' },
        ],
      });
    expect(r.status).toBe(400);
  });
  it('cannot complete a quiz using a progress request', async () => {
    const r = await request(app)
      .post('/lessons/' + lessonId + '/progress')
      .set(auth())
      .send({ sceneId: 'fractions-quiz', result: { viewed: true, xp: 999999 } });
    expect(r.status).toBe(400);
  });
  it('blocks role escalation during student registration', async () => {
    const r = await request(app)
      .post('/auth/register')
      .send({
        name: 'Unauthorized admin',
        email: randomUUID() + '@example.com',
        password: 'SafePassword123!',
        role: 'ADMIN',
      });
    expect(r.status).toBe(400);
  });
  it('rejects disguised uploads through the authenticated endpoint', async () => {
    const r = await request(app)
      .post('/uploads')
      .set(auth())
      .attach('file', Buffer.from('<script>not a pdf</script>'), 'unsafe.pdf');
    expect(r.status).toBe(400);
  });
  it('rejects student settings changes', async () => {
    const r = await request(app)
      .patch('/admin/settings')
      .set(auth())
      .send({ dailyGoalMinutes: 5, maxDailyGenerations: 100 });
    expect(r.status).toBe(403);
  });
  it('records a single completion reward transaction', async () => {
    const rewards = await rows<{ count: number }>(
      'SELECT COUNT(*) count FROM user_xp_transactions WHERE user_id=? AND reward_key=?',
      [userId, 'complete:' + lessonId],
    );
    expect(rewards[0].count).toBe(1);
  });
  it('regenerates an existing lesson as a new version without changing its ID', async () => {
    const admin = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'qwer1234!' });
    const response = await request(app)
      .post('/admin/lessons/' + lessonId + '/regenerate')
      .set({ Authorization: 'Bearer ' + admin.body.accessToken });
    expect(response.status).toBe(202);
    expect(response.body.lessonId).toBe(lessonId);
    await processNextJob(0);
    const versions = await rows<{ count: number }>(
      'SELECT COUNT(*) count FROM lesson_versions WHERE lesson_id=?',
      [lessonId],
    );
    expect(versions[0].count).toBe(2);
  });

  it('rejects activity submissions while a lesson is regenerating', async () => {
    await run("UPDATE lessons SET status='GENERATING' WHERE id=?", [lessonId]);
    const response = await request(app)
      .post('/lessons/' + lessonId + '/progress')
      .set(auth())
      .send({ sceneId: 'pizza', result: { parts: 4, selected: 1 }, lessonVersion: 1 });
    expect(response.status).toBe(409);
    await run("UPDATE lessons SET status='READY' WHERE id=?", [lessonId]);
  });
  it('rejects an obsolete lesson version after regeneration', async () => {
    const response = await request(app)
      .post('/lessons/' + lessonId + '/progress')
      .set(auth())
      .send({ sceneId: 'pizza', result: { parts: 4, selected: 1 }, lessonVersion: 1 });
    expect(response.status).toBe(409);
  });
  it('preserves the first checked quiz answer across page reloads', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'First choices',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    expect(generated.status).toBe(202);
    await processNextJob(0);
    const id = generated.body.lessonId;
    const check = await request(app)
      .post('/lessons/' + id + '/quiz/check')
      .set(auth())
      .send({ sceneId: 'fractions-quiz', questionId: 'q1', optionId: 'b' });
    expect(check.body.correct).toBe(false);
    const corrected = await request(app)
      .post('/lessons/' + id + '/quiz/submit')
      .set(auth())
      .send({
        sceneId: 'fractions-quiz',
        answers: [
          { questionId: 'q1', optionId: 'a' },
          { questionId: 'q2', optionId: 'b' },
          { questionId: 'q3', optionId: 'c' },
        ],
      });
    expect(corrected.body.score).toBe(67);
  });
  it('does not count authenticated session reads as credential attempts', async () => {
    for (let i = 0; i < 85; i++) {
      const response = await request(app).get('/auth/me').set(auth());
      expect(response.status).toBe(200);
    }
  });
  it('does not let historical failure poison a regenerated lesson', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Retry fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    await run("UPDATE generation_jobs SET status='FAILED' WHERE id=?", [generated.body.jobId]);
    await run("UPDATE lessons SET status='FAILED' WHERE id=?", [generated.body.lessonId]);
    const retry = await request(app)
      .post('/lessons/' + generated.body.lessonId + '/regenerate')
      .set(auth())
      .send({});
    expect(retry.status).toBe(202);
    await processNextJob(0);
    const lesson = await request(app)
      .get('/lessons/' + generated.body.lessonId)
      .set(auth());
    expect(lesson.body.status).toBe('READY');
  });
  it('fences a stale failing worker after a replacement has completed', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Fenced fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    const provider = new MockAIProvider();
    vi.spyOn(provider, 'generateLesson').mockImplementation(async () => {
      await run(
        'UPDATE generation_jobs SET heartbeat_at=UTC_TIMESTAMP()-INTERVAL 10 MINUTE WHERE id=?',
        [generated.body.jobId],
      );
      await processNextJob(0);
      throw new Error('Old worker failed after replacement');
    });
    const factory = vi.spyOn(providerModule, 'createProvider').mockReturnValueOnce(provider);
    try {
      await processNextJob(0);
      const job = await request(app)
        .get('/generation-jobs/' + generated.body.jobId)
        .set(auth());
      expect(job.body.status).toBe('COMPLETED');
      expect(job.body.attempt).toBe(2);
      expect(
        job.body.agents.every(
          (task: { attempt: number; status: string }) =>
            task.attempt === 2 && task.status === 'COMPLETED',
        ),
      ).toBe(true);
      const oldTasks = await rows<{ role: string; status: string }>(
        'SELECT role,status FROM generation_agent_tasks WHERE job_id=? AND attempt=1',
        [generated.body.jobId],
      );
      expect(oldTasks.find((task) => task.role === 'PLANNER')?.status).toBe('CANCELLED');
      const lesson = await request(app)
        .get('/lessons/' + generated.body.lessonId)
        .set(auth());
      expect(lesson.body.status).toBe('READY');
    } finally {
      factory.mockRestore();
    }
  });
  it('exposes bounded collaborating agent tasks without lesson answers or source text', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Agent fractions',
      subject: 'MATHEMATICS',
      content: 'Private source: fractions are equal parts of a whole.',
    });
    await processNextJob(0);
    const job = await request(app)
      .get('/generation-jobs/' + generated.body.jobId)
      .set(auth());
    expect(job.body.status).toBe('COMPLETED');
    expect(job.body.attempt).toBe(1);
    expect(job.body.agents.map((a: { role: string }) => a.role)).toEqual([
      'ANALYST',
      'PLANNER',
      'SCENE_SPECIALIST',
      'SCENE_SPECIALIST',
      'QUIZ_SPECIALIST',
      'VALIDATOR',
    ]);
    expect(
      job.body.agents.every(
        (agent: { estimatedCost: unknown }) => typeof agent.estimatedCost === 'number',
      ),
    ).toBe(true);
    expect(
      job.body.agents.every(
        (a: { status: string; progress: number }) => a.status === 'COMPLETED' && a.progress === 100,
      ),
    ).toBe(true);
    expect(JSON.stringify(job.body)).not.toContain('Private source');
    expect(JSON.stringify(job.body)).not.toContain('correctOptionId');
  });
  it('runs two scene specialists concurrently and waits for all work before failing', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Agent failure fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    let active = 0,
      peak = 0,
      completed = 0;
    const original = MockAIProvider.prototype.regenerateScene;
    const specialist = vi
      .spyOn(MockAIProvider.prototype, 'regenerateScene')
      .mockImplementation(async function (input, scene) {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) =>
          setTimeout(resolve, scene.type === 'FRACTION_PIZZA' ? 5 : 40),
        );
        active--;
        completed++;
        if (scene.type === 'FRACTION_PIZZA') throw new Error('secret provider failure');
        return original.call(this, input, scene);
      });
    try {
      await processNextJob(0);
      expect(peak).toBe(2);
      expect(active).toBe(0);
      expect(completed).toBe(2);
      const job = await request(app)
        .get('/generation-jobs/' + generated.body.jobId)
        .set(auth());
      expect(job.body.status).toBe('FAILED');
      expect(job.body.agents.some((a: { status: string }) => a.status === 'FAILED')).toBe(true);
      expect(job.body.agents.some((a: { status: string }) => a.status === 'CANCELLED')).toBe(true);
      expect(JSON.stringify(job.body)).not.toContain('secret provider failure');
      const lesson = await request(app)
        .get('/lessons/' + generated.body.lessonId)
        .set(auth());
      expect(lesson.body.status).toBe('FAILED');
      expect(lesson.body.definition).toBeNull();
    } finally {
      specialist.mockRestore();
    }
  });
  it('records every agent call once in job and AI usage totals', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Metered fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    class MeteredProvider extends MockAIProvider {
      meter = { tokensInput: 0, tokensOutput: 0, estimatedCost: 0 };
      bill() {
        this.meter.tokensInput += 100;
        this.meter.tokensOutput += 200;
        this.meter.estimatedCost += 0.01;
      }
      getUsage() {
        return { ...this.meter };
      }
      async analyzeContent(input: Parameters<MockAIProvider['analyzeContent']>[0]) {
        this.bill();
        return super.analyzeContent(input);
      }
      async generateLesson(
        input: Parameters<MockAIProvider['generateLesson']>[0],
        analysis: Parameters<MockAIProvider['generateLesson']>[1],
      ) {
        this.bill();
        return super.generateLesson(input, analysis);
      }
      async regenerateScene(
        input: Parameters<MockAIProvider['regenerateScene']>[0],
        scene: Parameters<MockAIProvider['regenerateScene']>[1],
      ) {
        this.bill();
        return super.regenerateScene(input, scene);
      }
    }
    const factory = vi
      .spyOn(providerModule, 'createProvider')
      .mockImplementation(() => new MeteredProvider());
    try {
      await processNextJob(0);
      const [job] = await rows<{
        tokens_input: number;
        tokens_output: number;
        estimated_cost: number;
      }>('SELECT tokens_input,tokens_output,estimated_cost FROM generation_jobs WHERE id=?', [
        generated.body.jobId,
      ]);
      expect(job.tokens_input).toBe(500);
      expect(job.tokens_output).toBe(1000);
      expect(job.estimated_cost).toBeCloseTo(0.05);
      const usage = await rows<{ tokens_input: number }>(
        'SELECT tokens_input FROM ai_usage WHERE job_id=?',
        [generated.body.jobId],
      );
      expect(usage).toHaveLength(1);
      expect(usage[0].tokens_input).toBe(500);
      const detail = await request(app)
        .get('/generation-jobs/' + generated.body.jobId)
        .set(auth());
      expect(
        detail.body.agents.filter((a: { tokensInput: number }) => a.tokensInput === 100),
      ).toHaveLength(5);
      expect(
        detail.body.agents.find((a: { role: string }) => a.role === 'VALIDATOR').tokensInput,
      ).toBe(0);
    } finally {
      factory.mockRestore();
    }
  });
  it('refuses to publish a specialist scene that changes the shared plan identity', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Invalid specialist fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    const original = MockAIProvider.prototype.regenerateScene;
    const specialist = vi
      .spyOn(MockAIProvider.prototype, 'regenerateScene')
      .mockImplementation(async function (input, scene) {
        return { ...(await original.call(this, input, scene)), id: 'unexpected-scene' };
      });
    try {
      await processNextJob(0);
      const detail = await request(app)
        .get('/generation-jobs/' + generated.body.jobId)
        .set(auth());
      expect(detail.body.status).toBe('FAILED');
      const lesson = await request(app)
        .get('/lessons/' + generated.body.lessonId)
        .set(auth());
      expect(lesson.body.definition).toBeNull();
    } finally {
      specialist.mockRestore();
    }
  });
  it('keeps the job lease alive while independent specialists are waiting for a provider', async () => {
    const generated = await request(app).post('/lessons/generate').set(auth()).send({
      title: 'Slow specialists fractions',
      subject: 'MATHEMATICS',
      content: 'Fractions are equal parts of a whole.',
    });
    let begin!: () => void, finish!: () => void;
    const started = new Promise<void>((resolve) => {
      begin = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let tick: (() => void) | undefined;
    const originalInterval = globalThis.setInterval;
    const timer = vi.spyOn(globalThis, 'setInterval').mockImplementation((handler, ...args) => {
      tick = handler as () => void;
      return originalInterval(handler, ...args);
    });
    const original = MockAIProvider.prototype.regenerateScene;
    const specialist = vi
      .spyOn(MockAIProvider.prototype, 'regenerateScene')
      .mockImplementation(async function (input, scene) {
        if (scene.type === 'FRACTION_PIZZA') {
          begin();
          await blocked;
        }
        return original.call(this, input, scene);
      });
    let worker: Promise<boolean> | undefined;
    try {
      worker = processNextJob(0);
      await started;
      await run(
        'UPDATE generation_jobs SET heartbeat_at=UTC_TIMESTAMP()-INTERVAL 10 MINUTE WHERE id=?',
        [generated.body.jobId],
      );
      expect(tick).toBeTypeOf('function');
      tick!();
      let age = 600;
      for (let tries = 0; tries < 10 && age >= 300; tries++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
        const [job] = await rows<{ age: number }>(
          'SELECT TIMESTAMPDIFF(SECOND,heartbeat_at,UTC_TIMESTAMP()) age FROM generation_jobs WHERE id=?',
          [generated.body.jobId],
        );
        age = job.age;
      }
      expect(age).toBeLessThan(300);
      const detail = await request(app)
        .get('/generation-jobs/' + generated.body.jobId)
        .set(auth());
      expect(detail.body.status).toBe('PROCESSING');
      expect(
        detail.body.agents.some(
          (a: { status: string; role: string }) =>
            a.role === 'SCENE_SPECIALIST' && a.status === 'PROCESSING',
        ),
      ).toBe(true);
      finish();
      await worker;
      const ready = await request(app)
        .get('/generation-jobs/' + generated.body.jobId)
        .set(auth());
      expect(ready.body.status).toBe('COMPLETED');
    } finally {
      finish();
      await worker;
      specialist.mockRestore();
      timer.mockRestore();
    }
  });
  it('provisions the first super administrator and refuses a second bootstrap', async () => {
    const { bootstrapAdmin } = await import('../src/db/bootstrap-admin.js');
    const admin = await bootstrapAdmin({
      name: 'First operator',
      email: randomUUID() + '@example.com',
      password: 'OperatorPassword123!',
    });
    try {
      const result = await request(app)
        .post('/auth/login')
        .send({ email: admin.email, password: 'OperatorPassword123!' });
      expect(result.body.user.roles).toContain('SUPER_ADMIN');
      await expect(
        bootstrapAdmin({
          name: 'Second operator',
          email: randomUUID() + '@example.com',
          password: 'OperatorPassword123!',
        }),
      ).rejects.toThrow('already exists');
    } finally {
      await run('DELETE FROM users WHERE id=?', [admin.id]);
    }
  });
});
it('dashboard finds an older in-progress lesson outside its recent page', async () => {
  const account = await request(app)
    .post('/auth/register')
    .send({
      name: 'Dashboard student',
      email: randomUUID() + '@example.com',
      password: 'SafePassword123!',
    });
  const header = { Authorization: 'Bearer ' + account.body.accessToken };
  try {
    const duplicate = await request(app)
      .post('/lessons/20000000-0000-4000-8000-000000000001/duplicate')
      .set(header);
    const id = duplicate.body.id;
    expect(duplicate.status).toBe(201);
    const progress = await request(app)
      .post('/lessons/' + id + '/progress')
      .set(header)
      .send({ sceneId: 'pizza', result: { parts: 4, selected: 1 } });
    expect(progress.status).toBe(200);
    for (let i = 0; i < 7; i++)
      expect(
        (
          await request(app)
            .post('/lessons/20000000-0000-4000-8000-000000000001/duplicate')
            .set(header)
        ).status,
      ).toBe(201);
    const dashboard = await request(app).get('/dashboard').set(header);
    expect(dashboard.body.continueLearning).toMatchObject({ id, progress: 33 });
    expect(dashboard.body.recent.some((lesson: { id: string }) => lesson.id === id)).toBe(false);
  } finally {
    await run('DELETE FROM users WHERE id=?', [account.body.user.id]);
  }
});
