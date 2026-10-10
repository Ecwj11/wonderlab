import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool, rows, run } from './pool.js';
export async function migrate() {
  await run(
    'CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(255) PRIMARY KEY, applied_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3))',
  );
  const path = fileURLToPath(new URL('../../migrations/', import.meta.url));
  for (const name of (await readdir(path)).filter((n) => n.endsWith('.sql')).sort()) {
    if ((await rows('SELECT id FROM schema_migrations WHERE id=?', [name])).length) continue;
    const sql = await readFile(path + name, 'utf8');
    for (const statement of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await run(statement);
    await run('INSERT INTO schema_migrations(id) VALUES(?)', [name]);
    console.log(`Applied ${name}`);
  }
}
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js'))
  migrate()
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
      pool.end();
    });
