import { expect, it } from 'vitest';
import { childUpdateSchema } from '@wonderlab/shared';
it('patching a child status does not reset unrelated parental controls', () => {
  expect(childUpdateSchema.parse({ status: 'SUSPENDED' })).toEqual({ status: 'SUSPENDED' });
  expect(childUpdateSchema.safeParse({}).success).toBe(false);
});

it('validates optional grade restrictions without resetting them on unrelated edits', () => {
  expect(childUpdateSchema.parse({ allowedSchoolLevels: ['Primary 2', 'Secondary 1'] })).toEqual({
    allowedSchoolLevels: ['Primary 2', 'Secondary 1'],
  });
  expect(childUpdateSchema.parse({ allowedSchoolLevels: null })).toEqual({
    allowedSchoolLevels: null,
  });
  for (const allowedSchoolLevels of [[], ['Primary 7'], ['Primary 2', 'Primary 2']])
    expect(childUpdateSchema.safeParse({ allowedSchoolLevels }).success).toBe(false);
});
