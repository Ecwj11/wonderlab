import { readFile } from 'node:fs/promises';
import { lessonSchema, type LessonDefinition } from '@wonderlab/shared';
import { config } from '../config.js';
import { pool, rows, run, transaction } from './pool.js';
import { saveDefinition } from '../services/lessons.js';
export const storyLessonId = '81000000-0000-4000-8000-000000000001';
export async function loadStoryLesson(): Promise<LessonDefinition> {
  const definition = lessonSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../../src/db/content/chinese-garden-story.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  if (
    definition.title !== '小雨的种子：3D有声故事' ||
    definition.subject !== 'GENERAL' ||
    definition.language !== 'Chinese' ||
    definition.scenes.length !== 1 ||
    definition.scenes[0].type !== 'INTERACTIVE_STORY'
  )
    throw new Error(
      'The curated story must contain the expected single Chinese school garden story.',
    );
  return definition;
}
export async function seedStoryLesson(ownerEmail = 'teacher@example.com', dryRun = false) {
  if (config.NODE_ENV === 'production' && !dryRun)
    throw new Error('Run story seeding through an explicit development/maintenance environment.');
  const definition = await loadStoryLesson();
  if (dryRun) return { created: 0, skipped: 0, validated: 1 };
  return transaction(async (db) => {
    const [owner] = await rows<{ id: string }>(
      "SELECT u.id FROM users u WHERE u.email=? AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role_id IN ('TEACHER','ADMIN','SUPER_ADMIN')) FOR UPDATE",
      [ownerEmail],
      db,
    );
    if (!owner) throw new Error('Story owner must be an active teacher or administrator.');
    const existing = await rows(
      'SELECT id FROM lessons WHERE id=? FOR UPDATE',
      [storyLessonId],
      db,
    );
    if (existing.length) return { created: 0, skipped: 1, validated: 1 };
    await run(
      "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content,input_type) VALUES(?,?,?,'GENERAL','Chinese','Primary 1–3','PUBLIC','GENERATING',?,'TEXT')",
      [
        storyLessonId,
        owner.id,
        definition.title,
        'Curated Chinese school garden story v1. ' + JSON.stringify(definition),
      ],
      db,
    );
    await saveDefinition(storyLessonId, definition, db);
    return { created: 1, skipped: 0, validated: 1 };
  });
}
if (process.argv[1]?.endsWith('/story-seed.ts') || process.argv[1]?.endsWith('/story-seed.js')) {
  const email = process.argv
    .find((arg) => arg.startsWith('--owner-email='))
    ?.slice('--owner-email='.length);
  seedStoryLesson(email, process.argv.includes('--dry-run'))
    .then((result) => console.log('Chinese garden story:', result))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
