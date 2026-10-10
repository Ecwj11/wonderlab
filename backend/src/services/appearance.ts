import { appearanceSchema, defaultAppearance } from '@wonderlab/shared';
import { rows, run } from '../db/pool.js';

export async function getAppearance() {
  const [row] = await rows<{ value: unknown }>(
    "SELECT value FROM system_settings WHERE id='appearance'",
  );
  return appearanceSchema.parse(
    row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : defaultAppearance,
  );
}

export async function saveAppearance(input: unknown) {
  const appearance = appearanceSchema.parse(input);
  await run(
    "INSERT INTO system_settings(id,value) VALUES('appearance',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",
    [JSON.stringify(appearance)],
  );
  return appearance;
}
