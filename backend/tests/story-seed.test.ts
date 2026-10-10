import { afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://wonderlab:local-wonderlab-db@127.0.0.1:3307/wonderlab_test';
if (new URL(process.env.DATABASE_URL).pathname !== '/wonderlab_test')
  throw new Error('Story seed tests require isolated wonderlab_test');
const { pool, rows, run } = await import('../src/db/pool.js');
const { migrate } = await import('../src/db/migrate.js');
const { seedStoryLesson, storyLessonId, loadStoryLesson } = await import('../src/db/story-seed.js');
const { config } = await import('../src/config.js');
afterAll(() => pool.end());
it('validates and seeds one public Chinese story while preserving edits and all existing account data', async () => {
  await migrate();
  const ownerId = randomUUID();
  const email = `story-owner-${ownerId}@example.com`;
  await run("INSERT IGNORE INTO roles(id,name) VALUES('TEACHER','TEACHER')");
  await run("INSERT IGNORE INTO subjects(id,name,color) VALUES('GENERAL','General','violet')");
  await run('INSERT INTO users(id,name,email,password_hash,xp) VALUES(?,?,?,?,123)', [
    ownerId,
    'Story owner',
    email,
    'existing-password',
  ]);
  await run("INSERT INTO user_roles(user_id,role_id) VALUES(?,'TEACHER')", [ownerId]);
  try {
    expect((await loadStoryLesson()).scenes[0].type).toBe('INTERACTIVE_STORY');
    expect(await seedStoryLesson(email, true)).toEqual({ created: 0, skipped: 0, validated: 1 });
    expect(await rows('SELECT id FROM lessons WHERE id=?', [storyLessonId])).toHaveLength(0);
    await expect(seedStoryLesson('absent-owner@example.com')).rejects.toThrow('active teacher');
    expect(await seedStoryLesson(email)).toEqual({ created: 1, skipped: 0, validated: 1 });
    expect(
      await rows(
        'SELECT title,language,school_level schoolLevel,visibility,status FROM lessons WHERE id=?',
        [storyLessonId],
      ),
    ).toEqual([
      {
        title: '小雨的种子：3D有声故事',
        language: 'Chinese',
        schoolLevel: 'Primary 1–3',
        visibility: 'PUBLIC',
        status: 'READY',
      },
    ]);
    await run('UPDATE lessons SET title=? WHERE id=?', ['Teacher edited story', storyLessonId]);
    expect(await seedStoryLesson(email)).toEqual({ created: 0, skipped: 1, validated: 1 });
    expect(await rows('SELECT title FROM lessons WHERE id=?', [storyLessonId])).toEqual([
      { title: 'Teacher edited story' },
    ]);
    expect(
      await rows('SELECT version FROM lesson_versions WHERE lesson_id=?', [storyLessonId]),
    ).toEqual([{ version: 1 }]);
    expect(await rows('SELECT xp,password_hash FROM users WHERE id=?', [ownerId])).toEqual([
      { xp: 123, password_hash: 'existing-password' },
    ]);
    expect(await rows('SELECT id FROM generation_jobs WHERE user_id=?', [ownerId])).toHaveLength(0);
  } finally {
    await run('DELETE FROM users WHERE id=?', [ownerId]);
  }
});
it('requires an explicit development or maintenance environment before publishing', async () => {
  const prior = config.NODE_ENV;
  config.NODE_ENV = 'production';
  try {
    await expect(seedStoryLesson()).rejects.toThrow('development/maintenance');
  } finally {
    config.NODE_ENV = prior;
  }
});
