import { test, expect, type Page } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { loadStoryLesson, storyLessonId } from '../../backend/src/db/story-seed.js';
import { pool, run } from '../../backend/src/db/pool.js';

test.afterAll(() => pool.end());
test.use({ actionTimeout: 15000, launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

test('child library opens 3D story and narration ducks music without changing its setting', async ({
  page,
}) => {
  test.skip(process.env.E2E_STORY !== '1', 'Opt in against the seeded Chinese story.');
  await page.goto('/child/login');
  await page.getByLabel('Family code', { exact: true }).fill('WONDER01');
  await page.getByLabel('Your username', { exact: true }).fill('alex');
  await page.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s play', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto('/app/library?search=' + encodeURIComponent('小雨的种子'));
  await expect(page.locator('.lesson-grid')).toContainText('小雨的种子');
  await page.goto('/app/lesson/' + storyLessonId);
  await expect(page.locator('[data-story-world]')).toHaveAttribute('data-render-mode', '3d');
  const music = page.locator('[data-background-music]');
  const voice = page.locator('[data-story-narration]');
  const provenance = JSON.parse(
    await readFile('frontend/public/audio/stories/garden/PROVENANCE.json', 'utf8'),
  );
  expect(provenance.revision).toBe(2);
  const firstVoice = await page.request.get('/audio/stories/garden/meet-xiaoyu.mp3');
  expect(firstVoice.status()).toBe(200);
  expect(
    createHash('sha256')
      .update(await firstVoice.body())
      .digest('hex'),
  ).toBe(provenance.entries[0].sha256);
  await page.locator('.music-settings').click();
  await page.locator('.music-popover input[type=range]').fill('25');
  await page.keyboard.press('Escape');
  await page.locator('.music-toggle').click();
  await expect
    .poll(() => music.evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0.1);
  await page.screenshot({ path: '.local/story/child-intro.png', fullPage: true });
  await page.getByRole('button', { name: '开始听故事', exact: true }).click();
  await expect
    .poll(() => voice.evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0.1);
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.volume)).toBe(0.05);
  await page.getByRole('button', { name: '暂停故事', exact: true }).click();
  await expect(voice).toHaveJSProperty('paused', true);
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.volume)).toBe(0.25);
  await page.getByRole('button', { name: '继续故事', exact: true }).click();
  await expect(voice).toHaveJSProperty('paused', false);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(voice).toHaveJSProperty('paused', true);
  await expect(page.locator('[data-story-world]')).toHaveAttribute('data-moving', 'false');
  await music.evaluate((audio: HTMLAudioElement) => {
    audio.dataset.instance = 'story-music';
  });
  await page.locator('.sidebar a.nav-item[href="/app/library"]').click();
  await expect(page).toHaveURL(/\/app\/library$/);
  await expect(music).toHaveAttribute('data-instance', 'story-music');
  await expect.poll(() => music.evaluate((audio: HTMLAudioElement) => audio.volume)).toBe(0.25);
  expect(await music.evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(false);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('wl_music_settings_v1')!).volume),
  ).toBe(0.25);
});

async function api(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: response.status === 204 ? null : await response.json(),
      };
    },
    { path, method, body },
  );
}

async function finishNarration(page: Page) {
  const voice = page.locator('[data-story-narration]');
  await expect.poll(() => voice.evaluate((audio: HTMLAudioElement) => !audio.paused)).toBe(true);
  // Real media plays and ends; accelerate it without synthesizing an ended event.
  await voice.evaluate((audio: HTMLAudioElement) => {
    audio.playbackRate = 16;
  });
  await expect.poll(() => voice.evaluate((audio: HTMLAudioElement) => audio.ended)).toBe(true);
  await expect(page.locator('[data-story-ready]')).toHaveAttribute('data-story-ready', 'true');
}

test('3D Chinese narration, walking tasks, resume and authoritative completion', async ({
  page,
}) => {
  test.skip(process.env.E2E_STORY !== '1', 'Opt in against the seeded Chinese story.');
  test.setTimeout(240000);
  let userId = '';
  const errors: string[] = [],
    remote: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).port === '4000') remote.push(request.url());
  });
  try {
    await page.goto('/login');
    const registration = await page.request.post('/api/auth/register', {
      data: {
        name: 'Chinese story verification',
        email: `story-${randomUUID()}@example.com`,
        password: 'qwer1234!Long',
      },
    });
    expect(registration.status()).toBe(201);
    userId = (await registration.json()).user.id;
    await page.goto('/app');
    await api(page, '/preferences', 'PATCH', { uiLanguage: 'en' });
    await page.goto('/app/library?search=' + encodeURIComponent('小雨的种子'));
    await expect(page.locator('.lesson-grid')).toContainText('小雨的种子');
    const duplicate = await api(page, `/lessons/${storyLessonId}/duplicate`, 'POST');
    expect(duplicate.status).toBe(201);
    const id = duplicate.body.id;
    const lesson = (await api(page, '/lessons/' + id)).body;
    expect(JSON.stringify(lesson.definition)).not.toMatch(/correctChoiceId|successText|retryText/);
    const definition = await loadStoryLesson();
    const scene = definition.scenes[0];
    if (scene.type !== 'INTERACTIVE_STORY') throw new Error('Expected narrated story');
    const before = (await api(page, '/auth/me')).body.xp;
    await page.goto('/app/lesson/' + id);
    const world = page.locator('[data-story-world]');
    const mission = page.locator('[data-story-mission]');
    await expect(mission).toContainText(scene.steps[0].task.prompt);
    await expect(mission).toHaveAttribute('data-phase', 'listen');
    await expect(world).toHaveAttribute('data-render-mode', '3d');
    await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
    await expect(
      page.getByRole('button', { name: 'Finish my adventure', exact: true }),
    ).toBeDisabled();
    const forged = await api(page, `/lessons/${id}/progress`, 'POST', {
      lessonVersion: lesson.lessonVersion,
      sceneId: scene.id,
      result: { viewed: true },
      elapsedSeconds: 1,
    });
    expect(forged.status).toBe(400);
    await page.getByRole('button', { name: '开始听故事', exact: true }).click();
    await expect(mission).toContainText('先听故事');
    await expect(page.locator('[data-world-target]')).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator('[data-story-narration]')
          .evaluate((audio: HTMLAudioElement) => audio.currentTime),
      )
      .toBeGreaterThan(0.1);
    await page.getByRole('button', { name: '暂停故事', exact: true }).click();
    await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: '继续故事', exact: true }).click();
    await finishNarration(page);
    for (const [index, step] of scene.steps.entries()) {
      await expect(page.locator('[data-story-step]')).toHaveAttribute('data-story-step', step.id);
      await expect(mission).toContainText(step.task.prompt);
      await expect(mission).toHaveAttribute('data-phase', 'action');
      const taskBox = await mission.boundingBox(),
        worldBox = await world.boundingBox();
      expect(taskBox!.y + taskBox!.height).toBeLessThan(worldBox!.y);
      const correct = step.task.choices.find((choice) => choice.id === step.task.correctChoiceId)!;
      if (index === 3) {
        // Pause after the server accepts the action but before its response
        // reaches React: that late success must not restart narration.
        await page.route('**/api/lessons/*/story/check', async (route) => {
          const response = await route.fetch();
          await page.evaluate(() => window.dispatchEvent(new Event('blur')));
          await expect(page.getByRole('button', { name: '继续故事', exact: true })).toBeVisible();
          await route.fulfill({ response });
          await page.unroute('**/api/lessons/*/story/check');
        });
      }
      if (index === 0) {
        const wrong = step.task.choices.find((choice) => choice.id !== correct.id)!;
        await page.locator(`[data-world-target="${wrong.target}"]`).click();
        await expect(world).toHaveAttribute('data-moving', 'true');
        await expect(page.locator('.story3d-feedback')).toHaveAttribute('data-correct', 'false', {
          timeout: 20000,
        });
        await expect(mission).toContainText('再试一次');
        await page.screenshot({ path: '.local/story/desktop.png', fullPage: true });
      }
      if (correct.target) await page.locator(`[data-world-target="${correct.target}"]`).click();
      else {
        const wrong = step.task.choices.find((choice) => choice.id !== correct.id)!;
        await page.locator(`[data-story-choice="${wrong.id}"]`).click();
        await expect(page.locator('.story3d-feedback')).toHaveAttribute('data-correct', 'false');
        await page.locator(`[data-story-choice="${correct.id}"]`).click();
      }
      if (index < scene.steps.length - 1) {
        await expect(page.locator('.story3d-feedback')).toHaveAttribute('data-correct', 'true', {
          timeout: 20000,
        });
        if (index === 0) {
          await page.reload();
          await expect(page.locator('[data-story-step]')).toHaveAttribute(
            'data-story-step',
            scene.steps[1].id,
          );
          await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
          await page.getByRole('button', { name: '继续听故事', exact: true }).click();
        } else if (index === 3) {
          await expect(mission).toContainText('故事已暂停');
          await page.waitForTimeout(1500); // Longer than the 900 ms auto-advance delay.
          await expect(page.locator('[data-story-step]')).toHaveAttribute(
            'data-story-step',
            step.id,
          );
          await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
          await page.getByRole('button', { name: '故事继续', exact: true }).click();
        } else {
          // A correct action must advance and start the next real audio file,
          // without clicking a continuation button.
          await expect(page.locator('[data-story-step]')).toHaveAttribute(
            'data-story-step',
            scene.steps[index + 1].id,
          );
        }
        await finishNarration(page);
      }
    }
    await expect(page.locator('.story3d-ending')).toBeVisible();
    await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: 'Finish my adventure', exact: true }).click();
    await expect(page.locator('.lesson-completion')).toBeVisible();
    expect((await api(page, `/lessons/${id}/progress`)).body.progress).toBe(100);
    expect((await api(page, '/auth/me')).body.xp - before).toBe(50);
    const replayReward = await api(page, `/lessons/${id}/progress`, 'POST', {
      lessonVersion: lesson.lessonVersion,
      sceneId: scene.id,
      result: {
        storyAnswers: scene.steps.map((step) => ({
          stepId: step.id,
          choiceId: step.task.correctChoiceId,
        })),
      },
      elapsedSeconds: 1,
    });
    expect(replayReward.status).toBe(200);
    expect(replayReward.body.xpEarned).toBe(0);
    await page.getByRole('button', { name: 'Practice again', exact: true }).click();
    await expect(page.locator('[data-story-step]')).toHaveAttribute(
      'data-story-step',
      scene.steps[0].id,
    );
    await expect(page.locator('.story3d-ending')).toHaveCount(0);
    await page.getByRole('button', { name: '我想自己读', exact: true }).click();
    await page.getByRole('button', { name: '继续朗读', exact: true }).click();
    await expect
      .poll(() =>
        page
          .locator('[data-story-narration]')
          .evaluate((audio: HTMLAudioElement) => audio.currentTime),
      )
      .toBeGreaterThan(0.1);
    await page.getByRole('button', { name: '读好了，开始互动', exact: true }).click();
    // Skipping the current paragraph preserves the selected listening mode.
    await page.locator('[data-world-target="XIAOYU"]').click();
    await expect(page.locator('[data-story-step]')).toHaveAttribute(
      'data-story-step',
      scene.steps[1].id,
    );
    await expect
      .poll(() =>
        page.locator('[data-story-narration]').evaluate((audio: HTMLAudioElement) => !audio.paused),
      )
      .toBe(true);
    await finishNarration(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(world).toHaveAttribute('data-render-mode', '3d');
    await page.screenshot({ path: '.local/story/mobile.png', fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: '从头再玩', exact: true }).click();
    await expect(page.getByRole('button', { name: '开始听故事', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '我想自己读', exact: true }).click();
    await page.locator('[data-world-target="XIAOYU"]').click();
    await expect(page.locator('[data-story-step]')).toHaveAttribute(
      'data-story-step',
      scene.steps[1].id,
    );
    await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
    await expect(page.locator('[data-story-ready]')).toHaveAttribute('data-story-ready', 'true');
    await page.locator('[data-world-target="GARDEN"]').click();
    await expect(page.getByRole('button', { name: '暂停自动继续', exact: true })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole('button', { name: '暂停自动继续', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-story-step]')).toHaveAttribute(
      'data-story-step',
      scene.steps[1].id,
    );
    await page.getByRole('button', { name: '故事继续', exact: true }).click();
    await page.locator('[data-world-target="SEEDS"]').click();
    await expect(page.locator('.story3d-feedback')).toHaveAttribute('data-correct', 'true', {
      timeout: 20000,
    });
    await page.getByRole('button', { name: '从头再玩', exact: true }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-story-step]')).toHaveAttribute(
      'data-story-step',
      scene.steps[0].id,
    );
    await expect(page.getByRole('button', { name: '开始听故事', exact: true })).toBeVisible();
    await expect(page.locator('[data-story-narration]')).toHaveJSProperty('paused', true);
    expect((await api(page, '/auth/me')).body.xp - before).toBe(50);
    expect(errors).toEqual([]);
    expect(remote).toEqual([]);
  } finally {
    if (userId) await run('DELETE FROM users WHERE id=?', [userId]);
  }
});
