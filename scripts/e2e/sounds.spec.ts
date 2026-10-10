import { test, expect } from '@playwright/test';
import { clearSounds, observeSounds } from './helpers/sounds';

test('buttons, menus and navigation render different sounds; mute and volume persist', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeSounds(page);
  await page.goto('/child/login');
  await expect(page.getByRole('button', { name: 'Sound settings', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.soundProbe.contexts)).toBe(0);
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundProbe.frequencies)).toEqual([440, 523]);
  await expect.poll(() => page.evaluate(() => window.soundProbe.peak)).toBeGreaterThan(0.001);
  await page.getByLabel('Sound volume', { exact: true }).fill('12');
  await clearSounds(page);
  await page.getByRole('button', { name: 'Try a sound', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundProbe.frequencies)).toEqual([784, 1047]);
  await expect.poll(() => page.evaluate(() => window.soundProbe.peak)).toBeGreaterThan(0.001);
  expect(await page.evaluate(() => window.soundProbe.peak)).toBeLessThan(0.04);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('audio[data-background-music]')
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sound effects on', exact: true }).click();
  expect(
    await page
      .locator('audio[data-background-music]')
      .evaluate((audio: HTMLAudioElement) => audio.paused),
  ).toBe(false);
  await clearSounds(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  expect(await page.evaluate(() => window.soundProbe.starts)).toBe(0);
  await expect(page.getByRole('button', { name: 'Try a sound', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  expect(await page.evaluate(() => window.soundProbe.starts)).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound effects off', exact: true })).toBeVisible();
  await expect(page.getByLabel('Sound volume', { exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Sound effects off', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundProbe.frequencies)).toContain(520);
  await page.keyboard.press('Escape');
  await clearSounds(page);
  await page.getByRole('link', { name: 'Parent', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/login$/);
  await expect.poll(() => page.evaluate(() => window.soundProbe.frequencies)).toEqual([392, 587]);
  await clearSounds(page);
  await page.getByRole('button', { name: 'Create a family account', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.soundProbe.frequencies)).toEqual([520]);
  await page.getByRole('link', { name: 'Child', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Sound settings', exact: true }).click();
  const bounds = await page
    .getByRole('dialog', { name: 'Sound settings', exact: true })
    .boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator('audio[data-background-music]')
      .evaluate((audio: HTMLAudioElement) => audio.paused),
  ).toBe(true);
  await page.screenshot({ path: '.local/sounds/mobile-controls.png', fullPage: true });
  expect(errors).toEqual([]);
});
