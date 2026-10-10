import { test, expect, type Page } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page).toHaveURL(email.startsWith('admin') ? /\/admin$/ : /\/app$/);
}

test('admin previews and applies three templates while student content stays usable', async ({
  page,
  browser,
  baseURL,
}) => {
  const studentContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const student = await studentContext.newPage();
  const errors: string[] = [];
  student.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, 'admin@example.com');
  await page.goto('/admin/settings');
  await expect(page.locator('.admin-appearance')).toBeVisible();
  const original = await page.evaluate(
    async () => (await (await fetch('/api/admin/appearance')).json()).template,
  );
  try {
    await signIn(student, 'student@example.com');
    for (const [id, name, heading] of [
      ['space', 'Space adventure', 'Ready for your next mission?'],
      ['clay', 'Clay discovery', 'Small steps. Big discoveries.'],
      ['playground', 'Learning playground', 'Big ideas. Little adventures.'],
    ]) {
      const previous = await student.locator('.app-shell').getAttribute('data-template');
      const popupPromise = page.waitForEvent('popup');
      await page.getByRole('link', { name: `Preview ${name}`, exact: true }).click();
      const preview = await popupPromise;
      await expect(preview.locator('.app-shell')).toHaveAttribute('data-template', id);
      await expect(preview.locator('.template-preview-notice')).toBeVisible();
      await preview.close();
      await student.reload();
      await expect(student.locator('.app-shell')).toHaveAttribute('data-template', previous!);

      await page.getByRole('radio', { name, exact: true }).check();
      const apply = page.getByRole('button', { name: 'Apply student template' });
      if (await apply.isEnabled()) {
        await apply.click();
        await expect(page.locator('.admin-appearance [role="status"]')).toContainText(name);
      }
      await student.reload();
      await expect(student.locator('.app-shell')).toHaveAttribute('data-template', id);
      await expect(student.locator('.kids-hero h2')).toHaveText(heading);
      await expect(student.locator('.template-hero-art')).toBeVisible();
      await expect
        .poll(() =>
          student
            .locator('.template-hero-art')
            .evaluate((el) => (el as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await student.goto(`/app?previewTemplate=${id === 'clay' ? 'space' : 'clay'}`);
      await expect(student.locator('.app-shell')).toHaveAttribute('data-template', id);
      await expect(student.locator('.template-preview-notice')).toHaveCount(0);

      for (const path of [
        '/app/create',
        '/app/library',
        '/app/lesson/30000000-0000-4000-8000-000000000001?restart=1',
      ]) {
        await student.goto(path);
        await expect(student.locator('.app-shell')).toHaveAttribute('data-template', id);
        expect(
          await student.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        ).toBe(false);
      }
      await expect(student.getByRole('button', { name: 'Next discovery' })).toBeDisabled();
      await student.getByRole('button', { name: 'Slice 1', exact: true }).click();
      await expect(student.getByRole('button', { name: 'Next discovery' })).toBeEnabled();
      await student.setViewportSize({ width: 390, height: 900 });
      await student.goto('/app');
      await expect(student.locator('.app-shell')).toHaveAttribute('data-template', id);
      expect(await student.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await student.setViewportSize({ width: 1440, height: 1000 });
    }
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(async (template) => {
      await fetch('/api/admin/appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
    }, original);
    await studentContext.close();
  }
});
