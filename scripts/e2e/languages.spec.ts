import { test, expect } from '@playwright/test';

test('a failed language save restores the previous display and preference', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const selector = page.getByRole('combobox', { name: 'Interface language', exact: true });
  await expect(selector).toBeEnabled();
  const original = await selector.inputValue();
  await page.route('**/api/preferences', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Service unavailable' } }),
    });
  });
  await selector.selectOption(original === 'zh' ? 'en' : 'zh');
  await expect(page.locator('.language-error')).toBeVisible();
  await expect(selector).toHaveValue(original);
  expect(
    await page.evaluate(async () => (await (await fetch('/api/preferences')).json()).uiLanguage),
  ).toBe(original);
});

test('each student can persist English, Chinese and stacked bilingual UI without breaking learning', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('student@example.com');
  await page.getByLabel('Password', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page).toHaveURL(/\/app$/);
  const selector = page.getByRole('combobox', { name: 'Interface language', exact: true });
  await expect(selector).toBeEnabled();
  const original = await page.evaluate(
    async () => (await (await fetch('/api/preferences')).json()).uiLanguage,
  );
  try {
    for (const language of ['zh', 'en-zh', 'en']) {
      await selector.selectOption(language);
      await expect
        .poll(async () =>
          page.evaluate(async () => (await (await fetch('/api/preferences')).json()).uiLanguage),
        )
        .toBe(language);
      await page.reload();
      await expect(selector).toHaveValue(language);
      const nav = page.locator('.sidebar nav a[href="/app"]');
      if (language === 'en') {
        await expect(nav).toContainText('Dashboard');
        await expect(nav).not.toContainText(/[\u4e00-\u9fff]/);
      } else {
        await expect(nav).toContainText(/[\u4e00-\u9fff]/);
        if (language === 'en-zh') {
          await expect(nav).toContainText('Dashboard');
          await expect(nav.locator('.localized-zh')).toBeVisible();
        } else await expect(nav).not.toContainText('Dashboard');
      }
      await page.goto('/app/create');
      if (language !== 'en')
        await expect(page.locator('.create-form-footer .button.primary')).toContainText(
          /[\u4e00-\u9fff]/,
        );
      await page.setViewportSize({ width: 390, height: 900 });
      await expect(selector).toHaveValue(language);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.goto('/app/lessons');
      await expect(page.locator('.collection-controls select')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await expect(page.locator('.lesson-card img,.lesson-card .lesson-art')).toHaveCount(0);
      await page.goto('/app/lesson/30000000-0000-4000-8000-000000000001?restart=1');
      await expect(page.locator('.pizza-svg')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('/app');
    }
  } finally {
    await page.evaluate(async (uiLanguage) => {
      await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiLanguage }),
      });
    }, original);
  }
});
