import { afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Integration tests require a database ending in _test');
const { pool, rows, run } = await import('../src/db/pool.js');
const { seedMathsLessons } = await import('../src/db/maths-seed.js');
const { loadMathsCatalogue } = await import('../src/db/maths-catalogue.js');
afterAll(() => pool.end());

it('atomically publishes the maths library once and preserves later edits and versions on rerun', async () => {
  const ownerId = randomUUID();
  const email = `maths-catalogue-${ownerId}@example.com`;
  await run('INSERT IGNORE INTO roles(id,name) VALUES(?,?)', ['TEACHER', 'TEACHER']);
  await run('INSERT INTO users(id,name,email,password_hash) VALUES(?,?,?,?)', [
    ownerId,
    'Catalogue test',
    email,
    'disabled-login',
  ]);
  await run('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)', [ownerId, 'TEACHER']);
  try {
    expect(await seedMathsLessons(email, true)).toEqual({ created: 0, skipped: 0, validated: 96 });
    expect(await rows('SELECT id FROM lessons WHERE user_id=?', [ownerId])).toHaveLength(0);
    expect(await seedMathsLessons(email)).toEqual({ created: 96, skipped: 0, validated: 96 });
    const [{ id }] = await loadMathsCatalogue();
    await run('UPDATE lessons SET title=? WHERE id=?', ['Teacher edited title', id]);
    expect(await seedMathsLessons(email)).toEqual({ created: 0, skipped: 96, validated: 96 });
    expect(
      await rows(
        "SELECT id FROM lessons WHERE user_id=? AND status='READY' AND visibility='PUBLIC'",
        [ownerId],
      ),
    ).toHaveLength(96);
    expect(await rows('SELECT title FROM lessons WHERE id=?', [id])).toEqual([
      { title: 'Teacher edited title' },
    ]);
    const [{ total }] = await rows<{ total: number }>(
      'SELECT COUNT(*) total FROM lesson_versions v JOIN lessons l ON l.id=v.lesson_id WHERE l.user_id=?',
      [ownerId],
    );
    expect(total).toBe(96);
    expect(await rows('SELECT id FROM generation_jobs WHERE user_id=?', [ownerId])).toHaveLength(0);
    expect(
      await rows('SELECT id FROM user_xp_transactions WHERE user_id=?', [ownerId]),
    ).toHaveLength(0);
    const catalogue = await loadMathsCatalogue();
    const item = catalogue[0];
    const oldScene = {
      id: item.definition.scenes[0].id,
      type: 'MATCHING',
      gameStyle: 'ADVENTURE',
      title: item.source.title,
      explanation: item.source.focus,
      pairs: item.source.missions.map((mission, index) => ({
        id: `mission-${index + 1}`,
        left: `${mission.left} + ${mission.right} = ?`,
        right: String(mission.left + mission.right),
      })),
    };
    await run('UPDATE lesson_versions SET definition=? WHERE lesson_id=?', [
      JSON.stringify({ ...item.definition, scenes: [oldScene, item.definition.scenes[1]] }),
      id,
    ]);
    await run(
      "UPDATE lesson_scenes s JOIN lesson_versions v ON v.id=s.lesson_version_id SET s.scene_type='MATCHING' WHERE v.lesson_id=? AND s.position=0",
      [id],
    );
    const { privateDefinition, saveDefinition } = await import('../src/services/lessons.js');
    const { lessonSchema } = await import('@wonderlab/shared');
    const untouchedCopy = randomUUID();
    const startedCopy = randomUUID();
    for (const copyId of [untouchedCopy, startedCopy]) {
      await run(
        "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content,input_type) SELECT ?,user_id,title,subject_id,language,school_level,'PRIVATE',status,source_content,input_type FROM lessons WHERE id=?",
        [copyId, id],
      );
      await saveDefinition(
        copyId,
        lessonSchema.parse({ ...item.definition, scenes: [oldScene, item.definition.scenes[1]] }),
        pool,
      );
    }
    await run('INSERT INTO lesson_progress(id,user_id,lesson_id,progress) VALUES(?,?,?,25)', [
      randomUUID(),
      ownerId,
      startedCopy,
    ]);
    expect(await seedMathsLessons(email, false, true)).toMatchObject({
      upgraded: 1,
      copiesUpgraded: 1,
    });
    expect((await privateDefinition(id)).scenes[0].type).toBe('NUMBER_GAME');
    expect((await privateDefinition(untouchedCopy)).scenes[0].type).toBe('NUMBER_GAME');
    expect((await privateDefinition(startedCopy)).scenes[0].type).toBe('MATCHING');
    expect(
      await rows('SELECT progress FROM lesson_progress WHERE lesson_id=?', [startedCopy]),
    ).toEqual([{ progress: 25 }]);
    expect(await rows('SELECT title FROM lessons WHERE id=?', [id])).toEqual([
      { title: 'Teacher edited title' },
    ]);
    expect(await seedMathsLessons(email, false, true)).toMatchObject({
      upgraded: 0,
      copiesUpgraded: 0,
    });
    const { getUser } = await import('../src/auth.js');
    const { recordProgress } = await import('../src/services/learning.js');
    const { numberRoundAnswer } = await import('@wonderlab/shared');
    for (const operation of ['SUBTRACT', 'MULTIPLY', 'DIVIDE']) {
      const game = catalogue.find(
        (entry) => entry.source.grade === 3 && entry.source.operation === operation,
      )!;
      const scene = game.definition.scenes[0];
      if (scene.type !== 'NUMBER_GAME') throw new Error('Number blocks required');
      const roundAnswers = scene.rounds.map((round) => ({
        roundId: round.id,
        value: numberRoundAnswer(round),
      }));
      const payload = {
        lessonVersion: 1,
        sceneId: scene.id,
        result: { roundAnswers },
        elapsedSeconds: 0,
      };
      await expect(
        recordProgress((await getUser(ownerId))!, game.id, {
          ...payload,
          result: {
            roundAnswers: roundAnswers.map((answer) => ({ ...answer, value: answer.value + 1 })),
          },
        }),
      ).rejects.toMatchObject({ code: 'ACTIVITY_INCOMPLETE' });
      expect(await recordProgress((await getUser(ownerId))!, game.id, payload)).toMatchObject({
        progress: 50,
        lessonCompleted: false,
      });
    }
  } finally {
    await run('DELETE FROM users WHERE id=?', [ownerId]);
  }
});
