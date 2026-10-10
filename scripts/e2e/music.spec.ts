import { test, expect } from '@playwright/test';

test('quiet music starts on request, loops and stops outside the child site', async ({ page }) => {
  const audioRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/audio/') && request.url().endsWith('.mp3'))
      audioRequests.push(request.url());
  });
  await page.goto('/child/login');
  const audio = page.locator('audio[data-background-music]');
  await expect(page.getByRole('button', { name: 'Play music', exact: true })).toBeEnabled();
  expect(audioRequests).toHaveLength(0);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0.1);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.volume)).toBe(0.18);
  expect(audioRequests.every((url) => url.startsWith(new URL('/audio/', page.url()).href))).toBe(
    true,
  );
  await audio.evaluate((element: HTMLAudioElement) => {
    element.currentTime = element.duration - 0.2;
  });
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeLessThan(5);
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await page.getByRole('button', { name: 'Music settings', exact: true }).click();
  await page.getByLabel('Music track', { exact: true }).selectOption('little-explorer');
  await page.getByLabel('Music volume', { exact: true }).fill('12');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Music settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Music settings', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Play music', exact: true })).toBeEnabled();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.volume)).toBe(0.12);
  expect(await audio.getAttribute('src')).toBe('/audio/little-explorer.mp3');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0.1);
  await page.getByRole('link', { name: 'Parent', exact: true }).click();
  await expect(page).toHaveURL(/\/parent\/login$/);
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await expect(page.locator('.music-controls')).toHaveCount(0);
  await page.getByRole('link', { name: 'Child', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play music', exact: true })).toBeVisible();
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
});

test('missing music has a friendly error and can be retried', async ({ page }) => {
  await page.route('**/audio/*.mp3', (route) => route.fulfill({ status: 404, body: 'Missing' }));
  await page.goto('/child/login');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect(page.locator('.music-controls').getByRole('alert')).toContainText(
    'Music couldn’t load. Please try again.',
  );
  await page.unroute('**/audio/*.mp3');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expect
    .poll(() => page.locator('audio').evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0.1);
  await expect(page.locator('.music-controls').getByRole('alert')).toHaveCount(0);
});

test('one player survives child login and learning navigation, with mobile bilingual controls', async ({
  page,
}) => {
  await page.goto('/child/login');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  const audio = page.locator('audio[data-background-music]');
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0.1);
  await audio.evaluate((element: HTMLAudioElement) => {
    element.currentTime = 20;
    element.dataset.instance = 'original';
  });
  await page.getByLabel('Family code', { exact: true }).fill('WONDER01');
  await page.getByLabel('Your username', { exact: true }).fill('alex');
  await page.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator('.app-shell')).toBeVisible();
  const savedLanguage = await page.getByLabel('Interface language', { exact: true }).inputValue();
  try {
    await page.getByLabel('Interface language', { exact: true }).selectOption('en');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-ui-language', 'en');
    await expect(audio).toHaveCount(1);
    await expect(audio).toHaveAttribute('data-instance', 'original');
    expect(
      await audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    ).toBeGreaterThan(20);
    await page.locator('.sidebar').getByRole('link', { name: 'My lessons', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/lessons$/);
    await expect(audio).toHaveAttribute('data-instance', 'original');
    expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
      .poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused))
      .toBe(false);
    await page.getByLabel('Interface language', { exact: true }).selectOption('zh');
    await expect(page.getByRole('button', { name: '暂停音乐', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '音乐设置', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('轻柔纯音乐');
    await page.keyboard.press('Escape');
    await page.getByLabel('Interface language', { exact: true }).selectOption('en-zh');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-ui-language', 'en-zh');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Music settings · 音乐设置', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Soft instrumental music');
    await expect(page.getByRole('dialog')).toContainText('轻柔纯音乐');
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({ path: '.local/music/mobile-controls.png', fullPage: true });
  } finally {
    await page.keyboard.press('Escape');
    await page.getByLabel('Interface language', { exact: true }).selectOption(savedLanguage);
  }
});
