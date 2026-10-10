import { expect, it } from 'vitest';
import { isSchoolLevelAllowed, schoolGradesForLevel } from '@wonderlab/shared';

it('matches exact grades, ranges and broad school labels', () => {
  expect(schoolGradesForLevel('Primary 1–3')).toEqual(['Primary 1', 'Primary 2', 'Primary 3']);
  expect(schoolGradesForLevel('Secondary 1-3')).toEqual([
    'Secondary 1',
    'Secondary 2',
    'Secondary 3',
  ]);
  expect(schoolGradesForLevel('Primary school')).toHaveLength(6);
  expect(schoolGradesForLevel(' primary 2 ')).toEqual(['Primary 2']);
  expect(isSchoolLevelAllowed('Primary 1–3', ['Primary 2'])).toBe(true);
  expect(isSchoolLevelAllowed('Primary 4–6', ['Primary 2'])).toBe(false);
  expect(isSchoolLevelAllowed('Secondary 1–3', ['Primary 2'])).toBe(false);
});

it('keeps unrestricted lessons and rejects unknown metadata only when restricted', () => {
  for (const level of [
    'Unspecified',
    'Primary 7',
    'Primary 5–2',
    'Secondary 1–7',
    'Primary 2 + 5',
  ]) {
    expect(isSchoolLevelAllowed(level, null)).toBe(true);
    expect(isSchoolLevelAllowed(level, ['Primary 2'])).toBe(false);
  }
});
