import { userPreferencesSchema } from '@wonderlab/shared';
import { rows, run } from '../db/pool.js';
import { ApiError } from '../http.js';

export async function getUserPreferences(userId: string) {
  const [preferences] = await rows<{ uiLanguage: string }>(
    'SELECT ui_language uiLanguage FROM users WHERE id=?',
    [userId],
  );
  if (!preferences) throw new ApiError(404, 'USER_NOT_FOUND', 'This account is unavailable.');
  return userPreferencesSchema.parse(preferences);
}
export async function saveUserPreferences(userId: string, input: unknown) {
  const preferences = userPreferencesSchema.parse(input);
  await run('UPDATE users SET ui_language=? WHERE id=?', [preferences.uiLanguage, userId]);
  return getUserPreferences(userId);
}
