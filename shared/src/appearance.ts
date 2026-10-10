import { z } from 'zod';

export const portalTemplateSchema = z.enum(['playground', 'space', 'clay']);
export type PortalTemplate = z.infer<typeof portalTemplateSchema>;
export const appearanceSchema = z.strictObject({ template: portalTemplateSchema });
export type PortalAppearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance: PortalAppearance = { template: 'playground' };
