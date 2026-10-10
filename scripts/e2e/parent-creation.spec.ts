import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { pool, run } from '../../backend/src/db/pool.js';

test.use({ actionTimeout: 15000 });

// Uses the configured live provider and real API. Only a temporary family is modified.
test('parents create shared lessons while children see learning without creation controls', async ({
  browser,
}) => {
  const parentContext = await browser.newContext();
  const childContext = await browser.newContext();
  const parent = await parentContext.newPage();
  const child = await childContext.newPage();
  const errors: string[] = [];
  parent.on('pageerror', (e) => errors.push(e.message));
  child.on('pageerror', (e) => errors.push(e.message));
  const unique = randomUUID();
  const title = 'Family fractions ' + unique.slice(0, 8);
  let parentId = '';
  let childId = '';
  let lessonId = '';
  try {
    await parent.goto('/parent/login');
    const registration = await parent.request.post('/api/auth/parent/register', {
      data: {
        name: 'Creation Parent',
        familyName: 'Creation Family',
        email: 'create-' + unique + '@example.com',
        password: 'qwer1234!Long',
      },
    });
    expect(registration.status()).toBe(201);
    parentId = (await registration.json()).user.id;
    await parent.goto('/parent/children');
    await parent.getByRole('button', { name: 'Add child', exact: true }).click();
    const editor = parent.locator('.family-editor');
    await expect(editor.locator('input[name=canGenerate]')).toHaveCount(0);
    await editor.getByLabel('Child’s name', { exact: true }).fill('Creation Child');
    await editor.getByLabel('School level', { exact: true }).fill('Primary 4');
    await editor.locator('input[name=username]').fill('explorer');
    await editor.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await editor.getByRole('button', { name: 'Create child profile', exact: true }).click();
    await expect(editor).toHaveCount(0);
    const family = await (await parent.request.get('/api/parent/dashboard')).json();
    childId = family.children[0].id;
    // Existing legacy permission must not restore child creation.
    const permission = await parent.request.patch('/api/parent/children/' + family.children[0].id, {
      headers: { Origin: new URL(parent.url()).origin },
      data: { canGenerate: true },
    });
    expect(permission.status()).toBe(200);
    await child.goto('/child/login');
    await child.getByLabel('Family code', { exact: true }).fill(family.family.code);
    await child.getByLabel('Your username', { exact: true }).fill('explorer');
    await child.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await child.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(child).toHaveURL(/\/app$/);
    for (const path of ['/app', '/app/lessons', '/app/library', '/app/challenges']) {
      await child.goto(path);
      await expect(child.locator('.sidebar')).toBeAttached();
      await expect(
        child.locator(
          path === '/app'
            ? '.dashboard'
            : path === '/app/challenges'
              ? '.challenge-card'
              : '.collection-page',
        ),
      ).toBeVisible();
      await expect(child.locator('a[href="/app/create"], a[href="/parent/create"]')).toHaveCount(0);
      await expect(child.getByRole('link', { name: 'Create a lesson', exact: true })).toHaveCount(
        0,
      );
    }
    await child.goto('/app/create');
    await expect(child).toHaveURL(/\/app\/lessons$/);
    await expect(child.locator('.create-form')).toHaveCount(0);
    // Library reuse stays available and creates a personal learning copy without AI generation.
    await child.goto('/app/library');
    await expect(child.locator('.collection-page')).toBeVisible();
    await child.locator('.lesson-card-action').first().click();
    await expect(child).toHaveURL(/\/app\/lesson\/[^/]+$/);
    const reused = await child.request.get('/api/lessons/' + child.url().split('/').at(-1));
    expect(reused.status()).toBe(200);
    expect((await reused.json()).userId).toBe(childId);
    const rejected = await child.request.post('/api/lessons/generate', {
      headers: { Origin: new URL(child.url()).origin },
      data: { title, subject: 'MATHEMATICS', content: 'Fractions are equal parts of a whole.' },
    });
    expect(rejected.status()).toBe(403);
    expect((await rejected.json()).error.code).toBe('GENERATION_RESTRICTED');

    await parent.getByRole('link', { name: 'Create a lesson', exact: true }).click();
    await expect(parent).toHaveURL(/\/parent\/create$/);
    await parent.getByLabel('Give your adventure a title', { exact: true }).fill(title);
    await parent
      .getByLabel(/^Your textbook content/)
      .fill('Fractions represent equal parts of a whole. One quarter is one of four equal parts.');
    const generated = parent.waitForResponse(
      (r) => r.url().endsWith('/api/lessons/generate') && r.request().method() === 'POST',
    );
    await parent.getByRole('button', { name: 'Generate interactive lesson', exact: true }).click();
    const response = await generated;
    expect(response.status()).toBe(202);
    const created = await response.json();
    lessonId = created.lessonId;
    await expect(parent.locator('.generation-page')).toBeVisible();
    await parent.getByRole('link', { name: 'Family lessons', exact: true }).click();
    await expect(parent.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await child.goto('/app/lessons');
    await expect(child.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(child.locator('.card-menu-button')).toHaveCount(0);
    const shared = await child.request.get('/api/lessons/' + lessonId);
    expect(shared.status()).toBe(200);
    const summary = await shared.json();
    expect(summary.userId).toBe(parentId);
    await mkdir('.local/parent-creation', { recursive: true });
    await parent.goto('/parent/create');
    await expect(parent.locator('.create-form')).toBeVisible();
    await parent.screenshot({ path: '.local/parent-creation/parent-desktop.png', fullPage: true });
    await parent.setViewportSize({ width: 390, height: 844 });
    await parent.getByLabel('Interface language', { exact: true }).selectOption('en-zh');
    await expect(parent.locator('.family-shell')).toHaveAttribute('data-ui-language', 'en-zh');
    await expect
      .poll(() => parent.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await parent.screenshot({ path: '.local/parent-creation/parent-mobile.png', fullPage: true });
    await child.goto('/app');
    await expect(child.locator('.dashboard')).toBeVisible();
    await child.screenshot({ path: '.local/parent-creation/child-dashboard.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    try {
      if (lessonId) await run('DELETE FROM lessons WHERE id=?', [lessonId]);
      if (childId) await run('DELETE FROM users WHERE id=?', [childId]);
      if (parentId) await run('DELETE FROM users WHERE id=?', [parentId]);
    } finally {
      await Promise.allSettled([parentContext.close(), childContext.close()]);
      await pool.end();
    }
  }
});
