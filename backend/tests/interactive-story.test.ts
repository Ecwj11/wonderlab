import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { storyLessonFixture } from '../../shared/tests/story-fixture.js';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (new URL(process.env.DATABASE_URL).pathname !== '/wonderlab_test')
  throw new Error('Story tests require isolated wonderlab_test');
const { createApp } = await import('../src/app.js');
const { pool, rows, run, transaction } = await import('../src/db/pool.js');
const { migrate } = await import('../src/db/migrate.js');
const { saveDefinition } = await import('../src/services/lessons.js');
const { lessonSchema } = await import('@wonderlab/shared');
const { tokens, getUser } = await import('../src/auth.js');
const app = createApp();
const userId = randomUUID();
const otherId = randomUUID();
const lessonId = randomUUID();
let header: { Authorization: string };
let otherHeader: { Authorization: string };
const sceneId = 'garden-story';
const answers = [
  { stepId: 'meet', choiceId: 'xiaoyu' },
  { stepId: 'question', choiceId: 'water' },
];
const check = (stepId: string, choiceId: string, lessonVersion = 1, auth = header) =>
  request(app)
    .post(`/lessons/${lessonId}/story/check`)
    .set(auth)
    .send({ lessonVersion, sceneId, stepId, choiceId });
const state = (lessonVersion = 1, auth = header) =>
  request(app).get(`/lessons/${lessonId}/story/state`).query({ lessonVersion, sceneId }).set(auth);
const complete = (result: unknown, lessonVersion = 1) =>
  request(app)
    .post(`/lessons/${lessonId}/progress`)
    .set(header)
    .send({ lessonVersion, sceneId, result });
beforeAll(async () => {
  await migrate();
  await run("INSERT IGNORE INTO subjects(id,name,color) VALUES('GENERAL','General','violet')");
  await run("INSERT IGNORE INTO roles(id,name) VALUES('STUDENT','STUDENT'),('PARENT','PARENT')");
  await run(
    "INSERT IGNORE INTO achievements(id,name,description,icon,threshold) VALUES('first-lesson','First','First','star',1)",
  );
  for (const id of [userId, otherId]) {
    await run('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)', [
      id,
      'Story test',
      `${id}@example.com`,
      'disabled-login',
    ]);
    await run("INSERT INTO user_roles(user_id,role_id) VALUES(?,'STUDENT')", [id]);
  }
  header = { Authorization: `Bearer ${(await tokens((await getUser(userId))!)).accessToken}` };
  otherHeader = {
    Authorization: `Bearer ${(await tokens((await getUser(otherId))!)).accessToken}`,
  };
  await transaction(async (db) => {
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content) VALUES(?,?,?,'GENERAL','Chinese','Primary 1–3','PRIVATE','READY','Story fixture')",
      [lessonId, userId, 'Story fixture'],
      db,
    );
    await saveDefinition(lessonId, lessonSchema.parse(storyLessonFixture), db);
  });
});
afterAll(async () => {
  await run('DELETE FROM users WHERE id IN (?,?)', [userId, otherId]);
  await pool.end();
});
describe('Trusted story answers', () => {
  it('redacts answer keys and private feedback at the lesson endpoint', async () => {
    const response = await request(app).get(`/lessons/${lessonId}`).set(header);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body.definition)).not.toMatch(
      /correctChoiceId|successText|retryText/,
    );
  });
  it('enforces access, explicit current version, known choices and ordered steps', async () => {
    expect((await state()).body).toEqual({ answers: [] });
    expect((await check('question', 'water')).body.error?.code).toBe('STORY_STEP_LOCKED');
    expect((await check('meet', 'unknown')).body.error?.code).toBe('INVALID_ANSWER');
    expect((await check('meet', 'xiaoyu', 2)).body.error?.code).toBe('LESSON_VERSION_CHANGED');
    expect((await state(2)).body.error?.code).toBe('LESSON_VERSION_CHANGED');
    expect((await check('meet', 'xiaoyu', 1, otherHeader)).status).toBe(404);
    expect((await state(1, otherHeader)).status).toBe(404);
    expect(
      (
        await request(app)
          .post(`/lessons/${lessonId}/story/check`)
          .set(header)
          .send({ sceneId, stepId: 'meet', choiceId: 'xiaoyu' })
      ).status,
    ).toBe(400);
    expect(
      (await request(app).get(`/lessons/${lessonId}/story/state`).set(header).query({ sceneId }))
        .status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get(`/lessons/${lessonId}/story/state`)
          .query({ lessonVersion: 1, sceneId })
      ).status,
    ).toBe(401);
  });
  it('rejects spoofed completion and permits wrong choices to retry without XP', async () => {
    for (const result of [{ viewed: true, score: 100, positions: [] }, { storyAnswers: answers }])
      expect((await complete(result)).body.error?.code).toBe('ACTIVITY_INCOMPLETE');
    expect((await check('meet', 'amin')).body).toEqual({
      stepId: 'meet',
      choiceId: 'amin',
      correct: false,
      feedback: '再看看。',
    });
    expect((await state()).body).toEqual({ answers: [] });
    expect((await check('question', 'water')).status).toBe(409);
    expect((await check('meet', 'xiaoyu')).body).toEqual({
      stepId: 'meet',
      choiceId: 'xiaoyu',
      correct: true,
      feedback: '找到了小雨！',
    });
    expect((await check('meet', 'xiaoyu')).body.correct).toBe(true);
    expect((await check('meet', 'amin')).body.correct).toBe(false);
    expect((await state()).body).toEqual({ answers: [answers[0]] });
    expect((await complete({ storyAnswers: answers })).status).toBe(400);
    expect((await check('question', 'ball')).body.correct).toBe(false);
    expect((await check('question', 'water')).body.correct).toBe(true);
    expect((await state()).body).toEqual({ answers });
    expect(await rows('SELECT id FROM scene_progress WHERE lesson_id=?', [lessonId])).toHaveLength(
      0,
    );
    expect(
      await rows('SELECT id FROM user_xp_transactions WHERE lesson_id=?', [lessonId]),
    ).toHaveLength(0);
  });
  it('requires exhaustive unique correct receipts and awards only 50 XP once', async () => {
    for (const storyAnswers of [
      [answers[0]],
      [answers[0], answers[0]],
      [answers[0], { ...answers[1], choiceId: 'ball' }],
      [answers[0], { ...answers[1], stepId: 'fake' }],
    ])
      expect((await complete({ storyAnswers })).status).toBe(400);
    const responses = await Promise.all([
      complete({ storyAnswers: answers }),
      complete({ storyAnswers: answers }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses.map((response) => response.body.xpEarned).sort()).toEqual([0, 50]);
    expect(responses[0].body).toMatchObject({ progress: 100, lessonCompleted: true });
    expect((await complete({ storyAnswers: answers })).body.xpEarned).toBe(0);
    expect(
      await rows('SELECT amount FROM user_xp_transactions WHERE lesson_id=?', [lessonId]),
    ).toEqual([{ amount: 50 }]);
    expect(await rows('SELECT xp FROM users WHERE id=?', [userId])).toEqual([{ xp: 50 }]);
  });
  it('isolates receipts by user and version and cascades version deletion', async () => {
    await run("UPDATE lessons SET visibility='PUBLIC' WHERE id=?", [lessonId]);
    expect((await state(1, otherHeader)).body).toEqual({ answers: [] });
    expect((await check('question', 'water', 1, otherHeader)).status).toBe(409);
    await transaction(async (db) =>
      saveDefinition(lessonId, lessonSchema.parse(storyLessonFixture), db),
    );
    expect((await check('meet', 'xiaoyu')).body.error?.code).toBe('LESSON_VERSION_CHANGED');
    expect((await state(2)).body).toEqual({ answers: [] });
    expect((await check('question', 'water', 2)).status).toBe(409);
    expect((await complete({ storyAnswers: answers }, 2)).status).toBe(400);
    await run('DELETE FROM lesson_versions WHERE lesson_id=? AND version=1', [lessonId]);
    expect(await rows('SELECT id FROM story_choices WHERE lesson_id=?', [lessonId])).toHaveLength(
      0,
    );
  });
  it('applies family sharing, subject and grade controls before saving receipts', async () => {
    const parent = await request(app)
      .post('/auth/parent/register')
      .send({
        name: 'Story parent',
        familyName: 'Story family',
        email: `${randomUUID()}@example.com`,
        password: 'StoryPassword123!',
      });
    expect(parent.status).toBe(201);
    const parentHeader = { Authorization: `Bearer ${parent.body.accessToken}` };
    let childId: string | undefined;
    try {
      const child = await request(app)
        .post('/parent/children')
        .set(parentHeader)
        .send({
          name: 'Story child',
          username: 'storychild',
          passcode: 'StoryPassword123!',
          schoolLevel: 'Primary 2',
          allowedSubjects: ['GENERAL'],
        });
      expect(child.status).toBe(201);
      childId = child.body.id;
      const childHeader = {
        Authorization: `Bearer ${(await tokens((await getUser(childId!))!)).accessToken}`,
      };
      await run("UPDATE lessons SET user_id=?,visibility='PRIVATE' WHERE id=?", [
        parent.body.user.id,
        lessonId,
      ]);
      expect((await state(2, childHeader)).status).toBe(200);
      await request(app)
        .patch(`/parent/children/${childId}`)
        .set(parentHeader)
        .send({ allowedSubjects: ['MATHEMATICS'] });
      expect((await state(2, childHeader)).body.error?.code).toBe('SUBJECT_RESTRICTED');
      expect((await check('meet', 'xiaoyu', 2, childHeader)).body.error?.code).toBe(
        'SUBJECT_RESTRICTED',
      );
      await request(app)
        .patch(`/parent/children/${childId}`)
        .set(parentHeader)
        .send({ allowedSubjects: ['GENERAL'], allowedSchoolLevels: ['Primary 5'] });
      expect((await state(2, childHeader)).body.error?.code).toBe('GRADE_RESTRICTED');
      expect((await check('meet', 'xiaoyu', 2, childHeader)).body.error?.code).toBe(
        'GRADE_RESTRICTED',
      );
      expect(await rows('SELECT id FROM story_choices WHERE user_id=?', [childId])).toHaveLength(0);
    } finally {
      await run('UPDATE lessons SET user_id=? WHERE id=?', [userId, lessonId]);
      if (childId) await run('DELETE FROM users WHERE id=?', [childId]);
      await run('DELETE FROM users WHERE id=?', [parent.body.user.id]);
    }
  });
  it('keeps distinct case-sensitive scene step IDs distinct in stored receipts', async () => {
    const id = randomUUID();
    const definition = structuredClone(storyLessonFixture);
    definition.scenes[0].steps[1].id = 'MEET';
    await transaction(async (db) => {
      await run(
        "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content) VALUES(?,?,?,'GENERAL','Chinese','Primary 1–3','PRIVATE','READY','Case fixture')",
        [id, userId, 'Case fixture'],
        db,
      );
      await saveDefinition(id, lessonSchema.parse(definition), db);
    });
    const submit = (stepId: string, choiceId: string) =>
      request(app)
        .post(`/lessons/${id}/story/check`)
        .set(header)
        .send({ lessonVersion: 1, sceneId, stepId, choiceId });
    expect((await submit('meet', 'xiaoyu')).body.correct).toBe(true);
    expect((await submit('MEET', 'water')).body.correct).toBe(true);
    const saved = await request(app)
      .get(`/lessons/${id}/story/state`)
      .set(header)
      .query({ lessonVersion: 1, sceneId });
    expect(saved.body.answers).toEqual([
      { stepId: 'meet', choiceId: 'xiaoyu' },
      { stepId: 'MEET', choiceId: 'water' },
    ]);
  });
});
