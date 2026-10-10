import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { pool, run, transaction } from '../../backend/src/db/pool.js';
import { saveDefinition } from '../../backend/src/services/lessons.js';

async function api(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const response = await fetch('/api' + path);
    if (!response.ok) throw new Error('API error ' + response.status);
    return response.json();
  }, path);
}

test('parents choose child lesson grades and children see only allowed courses', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const parentContext = await browser.newContext();
  const childContext = await browser.newContext();
  const parent = await parentContext.newPage();
  const child = await childContext.newPage();
  const unique = randomUUID();
  let parentId = '',
    childId = '';
  const lessons: Record<string, string> = {};
  try {
    await parent.goto('/parent/login');
    await parent.getByRole('button', { name: 'Create a family account', exact: true }).click();
    await parent.getByLabel('Your name', { exact: true }).fill('Grades Test Parent');
    await parent.getByLabel('Family name', { exact: true }).fill('Grade Verification Family');
    await parent
      .getByLabel('Email address', { exact: true })
      .fill('grades-e2e-' + unique + '@example.com');
    await parent.getByLabel('Password', { exact: true }).fill('GradePassword123!');
    await parent.getByRole('button', { name: 'Create family account', exact: true }).click();
    await expect(parent).toHaveURL(/\/parent$/);
    parentId = (await api(parent, '/auth/me')).id;
    await parent.goto('/parent/children');
    await parent.getByRole('button', { name: 'Add child', exact: true }).click();
    await expect(parent.getByRole('radio', { name: 'All grades', exact: true })).toBeChecked();
    await parent.getByLabel('Child’s name', { exact: true }).fill('Grade Explorer');
    await parent.getByLabel('School level', { exact: true }).fill('Primary 2');
    await parent.locator('input[name=username]').fill('explorer');
    await parent.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await parent.getByRole('button', { name: 'Create child profile', exact: true }).click();
    await expect(parent.getByRole('heading', { name: 'Grade Explorer' })).toBeVisible();
    let family = await api(parent, '/parent/dashboard');
    childId = family.children[0].id;
    expect(family.children[0].allowedSchoolLevels).toBeNull();

    for (const level of ['Primary 2', 'Primary 5', 'Primary 1–3', 'Unspecified']) {
      const id = randomUUID();
      lessons[level] = id;
      await transaction(async (db) => {
        await run(
          "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,visibility,status,source_content) VALUES(?,?,?,'MATHEMATICS','English',?,'PUBLIC','READY','Numbers')",
          [id, parentId, 'Grade verification ' + level + ' ' + unique, level],
          db,
        );
        await saveDefinition(
          id,
          {
            lessonSchemaVersion: 1,
            title: 'Grade verification ' + level,
            subject: 'MATHEMATICS',
            language: 'English',
            objectives: ['Learn numbers'],
            scenes: [
              {
                id: 'numbers',
                type: 'FLASHCARD',
                title: 'Numbers',
                explanation: 'Learn numbers',
                cards: [{ id: 'one', front: '1', back: 'One' }],
              },
            ],
          },
          db,
        );
      });
    }
    await parent.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await parent.getByRole('radio', { name: 'Choose specific grades', exact: true }).check();
    await expect(parent.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
    await parent.getByRole('checkbox', { name: 'Primary 2', exact: true }).check();
    await parent.getByRole('checkbox', { name: 'Secondary 2', exact: true }).check();
    await parent.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(parent.getByText('Child profile updated.', { exact: true })).toBeVisible();
    family = await api(parent, '/parent/dashboard');
    expect(family.children[0].allowedSchoolLevels).toEqual(['Primary 2', 'Secondary 2']);

    await child.goto('/child/login');
    await child.getByLabel('Family code', { exact: true }).fill(family.family.code);
    await child.getByLabel('Your username', { exact: true }).fill('explorer');
    await child.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await child.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(child).toHaveURL(/\/app$/);
    await child.goto('/app/library?search=' + encodeURIComponent(unique));
    await expect(
      child.locator('.lesson-card').filter({ hasText: 'Grade verification Primary 2' }),
    ).toBeVisible();
    await expect(
      child.locator('.lesson-card').filter({ hasText: 'Grade verification Primary 1–3' }),
    ).toBeVisible();
    await expect(
      child.locator('.lesson-card').filter({ hasText: 'Grade verification Primary 5' }),
    ).toHaveCount(0);
    await expect(
      child.locator('.lesson-card').filter({ hasText: 'Grade verification Unspecified' }),
    ).toHaveCount(0);
    const response = await child.request.get('/api/lessons/' + lessons['Primary 5']);
    expect(response.status()).toBe(403);
    expect((await response.json()).error.code).toBe('GRADE_RESTRICTED');
    await child.goto('/app/lesson/' + lessons['Primary 5']);
    await expect(
      child.getByText('Ask your parent to allow this lesson grade.', { exact: true }),
    ).toBeVisible();
    await expect(child.locator('.lesson-player')).toHaveCount(0);

    await parent.getByRole('combobox', { name: 'Interface language' }).selectOption('en-zh');
    await parent.getByRole('button', { name: /Edit profile/ }).click();
    await expect(parent.getByRole('checkbox', { name: /Primary 2/ })).toBeChecked();
    await expect(parent.getByRole('checkbox', { name: /Secondary 2/ })).toBeChecked();
    await expect(parent.getByText('允许学习的课程年级', { exact: true }).first()).toBeVisible();
    await parent.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => parent.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await mkdir('frontend/artifacts', { recursive: true });
    await parent.screenshot({
      path: 'frontend/artifacts/parent-grades-mobile-bilingual.png',
      fullPage: true,
    });
    await parent.getByRole('radio', { name: /All grades/ }).check();
    await parent.getByRole('button', { name: /Save changes/ }).click();
    await expect
      .poll(async () => (await api(parent, '/parent/dashboard')).children[0].allowedSchoolLevels)
      .toBeNull();
    expect((await child.request.get('/api/lessons/' + lessons['Primary 5'])).status()).toBe(200);
    await child.goto('/app/lesson/' + lessons['Primary 5']);
    await expect(
      child.getByRole('heading', { name: 'Grade verification Primary 5 ' + unique, exact: true }),
    ).toBeVisible();
    await parent.getByRole('button', { name: /Edit profile/ }).click();
    await parent.getByRole('radio', { name: /Choose specific grades/ }).check();
    await parent.getByRole('checkbox', { name: /Primary 2/ }).check();
    await parent.getByRole('button', { name: /Save changes/ }).click();
    await expect(
      child.getByText('Ask your parent to allow this lesson grade.', { exact: true }),
    ).toBeVisible({ timeout: 22000 });
  } finally {
    if (childId) await run('DELETE FROM users WHERE id=?', [childId]);
    if (parentId) await run('DELETE FROM users WHERE id=?', [parentId]);
    await parentContext.close();
    await childContext.close();
    await pool.end();
  }
});
