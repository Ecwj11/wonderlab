import { z } from 'zod';
export const uiLanguageSchema = z.enum(['en', 'zh', 'en-zh']);
export type UiLanguage = z.infer<typeof uiLanguageSchema>;
export const userPreferencesSchema = z.strictObject({ uiLanguage: uiLanguageSchema });
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
