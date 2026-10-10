import { config } from '../config.js';
import { pool, rows, run, transaction } from './pool.js';
import { loadMathsCatalogue } from './maths-catalogue.js';
import { saveDefinition, privateDefinition } from '../services/lessons.js';
import type { Db } from './pool.js';
type CatalogueItem = Awaited<ReturnType<typeof loadMathsCatalogue>>[number];

async function upgradeToBlocks(id: string, item: CatalogueItem, db: Db) {
  const [version] = await rows<{ total: number }>(
    'SELECT MAX(version) total FROM lesson_versions WHERE lesson_id=?',
    [id],
    db,
  );
  if (version.total !== 1) return false;
  const current = await privateDefinition(id, db);
  const scene = current.scenes[0];
  const symbols = { ADD: '+', SUBTRACT: '−', MULTIPLY: '×', DIVIDE: '÷' };
  if (
    scene.type !== 'MATCHING' ||
    scene.id !== item.definition.scenes[0].id ||
    scene.pairs.length !== item.source.missions.length ||
    !scene.pairs.every((pair, index) => {
      const mission = item.source.missions[index];
      return pair.left === `${mission.left} ${symbols[item.source.operation]} ${mission.right} = ?`;
    })
  )
    return false;
  await saveDefinition(
    id,
    { ...current, scenes: [item.definition.scenes[0], ...current.scenes.slice(1)] },
    db,
  );
  return true;
}

export async function seedMathsLessons(
  ownerEmail = 'teacher@example.com',
  dryRun = false,
  upgrade = false,
) {
  if (config.NODE_ENV === 'production' && !dryRun)
    throw new Error(
      'Run catalogue seeding through an explicit development/maintenance environment.',
    );
  // Validate every lesson before opening a transaction; an invalid batch publishes nothing.
  const catalogue = await loadMathsCatalogue();
  if (dryRun) return { created: 0, skipped: 0, validated: catalogue.length };
  const [owner] = await rows<{ id: string }>(
    "SELECT u.id FROM users u WHERE u.email=? AND u.status='ACTIVE' AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role_id IN ('TEACHER','ADMIN','SUPER_ADMIN'))",
    [ownerEmail],
  );
  if (!owner) throw new Error('Catalogue owner must be an active teacher or administrator.');
  return transaction(async (db) => {
    let created = 0;
    let skipped = 0;
    let upgraded = 0;
    let copiesUpgraded = 0;
    for (const item of catalogue) {
      const provenance =
        (item.source.key.includes('-extra-')
          ? 'Curated sample authored by Codex session; catalogue maths-primary-v2. '
          : 'Curated sample authored by Codex session subagents; catalogue maths-primary-v1. ') +
        JSON.stringify(item.source);
      const [existing] = await rows<{ source_content: string }>(
        'SELECT source_content FROM lessons WHERE id=? FOR UPDATE',
        [item.id],
        db,
      );
      if (existing) {
        if (
          upgrade &&
          existing.source_content === provenance &&
          (await upgradeToBlocks(item.id, item, db))
        )
          upgraded++;
        skipped++;
      } else {
        await run(
          "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content,input_type) VALUES(?,?,?,'MATHEMATICS','English',?,'PUBLIC','GENERATING',?,'TEXT')",
          [item.id, owner.id, item.definition.title, item.schoolLevel, provenance],
          db,
        );
        await saveDefinition(item.id, item.definition, db);
        created++;
      }
      if (upgrade) {
        const copies = await rows<{ id: string }>(
          "SELECT l.id FROM lessons l WHERE l.id<>? AND l.source_content=? AND l.status='READY' AND NOT EXISTS(SELECT 1 FROM lesson_progress p WHERE p.lesson_id=l.id) FOR UPDATE",
          [item.id, provenance],
          db,
        );
        for (const copy of copies) if (await upgradeToBlocks(copy.id, item, db)) copiesUpgraded++;
      }
    }
    return {
      created,
      skipped,
      validated: catalogue.length,
      ...(upgrade ? { upgraded, copiesUpgraded } : {}),
    };
  });
}

if (process.argv[1]?.endsWith('/maths-seed.ts') || process.argv[1]?.endsWith('/maths-seed.js')) {
  const email = process.argv
    .find((arg) => arg.startsWith('--owner-email='))
    ?.slice('--owner-email='.length);
  seedMathsLessons(
    email,
    process.argv.includes('--dry-run'),
    process.argv.includes('--upgrade-number-blocks'),
  )
    .then((result) => console.log('Primary 1–3 maths catalogue:', result))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
