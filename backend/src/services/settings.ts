import { z } from '@wonderlab/shared';
import { rows } from '../db/pool.js';
export const settingsSchema = z.strictObject({
  dailyGoalMinutes: z.number().int().min(5).max(60),
  maxDailyGenerations: z.number().int().min(1).max(100),
});
export async function getSettings() {
  const [row] = await rows<{ value: unknown }>(
    "SELECT value FROM system_settings WHERE id='learning'",
  );
  return settingsSchema.parse(
    row
      ? typeof row.value === 'string'
        ? JSON.parse(row.value)
        : row.value
      : { dailyGoalMinutes: 15, maxDailyGenerations: 20 },
  );
}
