import { test, expect, type Page } from '@playwright/test';
import { observeSounds } from './helpers/sounds';
import { randomUUID } from 'node:crypto';
import { loadMathsCatalogue } from '../../backend/src/db/maths-catalogue.js';
import { numberRoundAnswer } from '@wonderlab/shared';
import { pool, run } from '../../backend/src/db/pool.js';
test.afterAll(() => pool.end());
test.use({ actionTimeout: 15000 });

async function api(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      return response.status === 204 ? null : response.json();
    },
    { path, method, body },
  );
}
async function position(page: Page) {
  return page.locator('.forest-mascot').evaluate((element) => {
    const values = element.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!;
    return { x: Number(values[1]) - 24, y: Number(values[2]) - 32 };
  });
}
async function move(page: Page, target: number, jump = false) {
  const right = (await position(page)).x < target;
  const key = right ? 'ArrowRight' : 'ArrowLeft';
  await page.locator('.forest-game').focus();
  if (jump) await page.keyboard.down('Space');
  await page.keyboard.down(key);
  try {
    // Observe on animation frames in the browser; round-trip polling can hold
    // a movement key too long and overshoot a small platform under load.
    await page.locator('.forest-mascot').evaluate(
      (element, { target, right }) =>
        new Promise<void>((resolve, reject) => {
          const deadline = performance.now() + 7000;
          const tick = () => {
            const x =
              Number(element.getAttribute('transform')!.match(/translate\(([-\d.]+)/)![1]) - 24;
            if (right ? x >= target : x <= target) resolve();
            else if (performance.now() > deadline)
              reject(new Error(`Movement stopped at ${x}, expected ${target}`));
            else requestAnimationFrame(tick);
          };
          tick();
        }),
      { target, right },
    );
  } finally {
    await page.keyboard.up(key);
    if (jump) await page.keyboard.up('Space');
  }
}
async function collect(page: Page) {
  await move(page, 790);
  await move(page, 205);
  await move(page, 310, true);
  await expect.poll(async () => Math.round((await position(page)).y)).toBe(346);
  await move(page, 350);
  await move(page, 495, true);
  await expect.poll(async () => Math.round((await position(page)).y)).toBe(266);
  await move(page, 610);
  await move(page, 725);
  await expect.poll(async () => Math.round((await position(page)).y)).toBe(346);
}

for (const [grade, operation] of [
  [1, 'ADD'],
  [1, 'SUBTRACT'],
  [2, 'SUBTRACT'],
  [3, 'MULTIPLY'],
  [3, 'DIVIDE'],
] as const) {
  test(`P${grade} ${operation} number blocks completes four levels and the quiz`, async ({
    page,
  }) => {
    test.skip(
      process.env.E2E_MATH_BLOCKS !== '1',
      'Opt in against the real seeded maths catalogue.',
    );
    test.setTimeout(150000);
    if (process.env.E2E_SOUNDS === '1') await observeSounds(page);
    let userId = '';
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto('/login');
      const registration = await page.request.post('/api/auth/register', {
        data: {
          name: 'Block game verification',
          email: `blocks-${randomUUID()}@example.com`,
          password: 'qwer1234!Long',
        },
      });
      expect(registration.status()).toBe(201);
      userId = (await registration.json()).user.id;
      await page.goto('/app');
      await api(page, '/preferences', 'PATCH', { uiLanguage: 'en' });
      const item = (await loadMathsCatalogue()).find(
        (item) =>
          item.source.grade === grade &&
          item.source.operation === operation &&
          (process.env.E2E_MATH_EXTRA !== '1' || item.source.key.includes('-extra-')),
      )!;
      const { id } = await api(page, `/lessons/${item.id}/duplicate`, 'POST');
      const lesson = await api(page, '/lessons/' + id);
      const scene = item.definition.scenes[0];
      if (scene.type !== 'NUMBER_GAME') throw new Error('Expected number-block lesson');
      await page.goto('/app/lesson/' + id);
      await expect(page.locator('.forest-game')).toBeVisible();
      await page.getByRole('button', { name: 'Let’s play!', exact: true }).click();
      const view = await page.locator('.forest-landscape').getAttribute('viewBox');
      for (const [index, round] of scene.rounds.entries()) {
        await collect(page);
        if (round.blockMode !== 'VALUES' && round.operation === 'SUBTRACT') {
          for (let count = 0; count < round.right; count++)
            await page.getByRole('button', { name: /^Take away one block/ }).click();
        }
        await page.getByRole('button', { name: 'Build the bridge', exact: true }).click();
        const answer = numberRoundAnswer(round);
        if (index === 0) {
          const wrong = page
            .locator('.forest-answer-options button')
            .filter({ hasNotText: new RegExp(`^${answer}$`) })
            .first();
          await wrong.click();
          await expect(page.locator('.forest-bridge')).not.toHaveClass(/built/);
          await expect(page.locator('.forest-answer-feedback')).toContainText('try again');
        }
        await page
          .getByRole('button', {
            name:
              round.blockMode === 'VALUES' ? `Answer: ${answer}` : `Build with ${answer} blocks`,
            exact: true,
          })
          .click();
        await expect(page.locator('.forest-bridge')).toHaveClass(/built/);
        await expect(page.locator('.forest-level-win')).toHaveCount(0);
        await page.locator('.forest-game').focus();
        await page.keyboard.down('ArrowRight');
        await expect(page.locator('.forest-level-win')).toBeVisible();
        await page.keyboard.up('ArrowRight');
        expect(await page.locator('.forest-landscape').getAttribute('viewBox')).toBe(view);
        if (index === 0)
          await page.screenshot({
            path: `.local/maths-blocks/p${grade}-${operation}.png`,
            fullPage: true,
          });
        await page
          .getByRole('button', {
            name: index === scene.rounds.length - 1 ? 'Open the treasure' : 'Next level',
            exact: true,
          })
          .click();
      }
      await expect(page.locator('.forest-victory')).toBeVisible();
      await page.getByRole('button', { name: 'Next discovery', exact: true }).click();
      const quiz = item.definition.scenes[1];
      if (quiz.type !== 'QUIZ') throw new Error('Expected quiz');
      if (process.env.E2E_SOUNDS === '1') {
        // A real backend response arriving after navigation must stay silent.
        let release!: () => void;
        let fetched!: () => void;
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        const ready = new Promise<void>((resolve) => {
          fetched = resolve;
        });
        await page.route('**/api/lessons/*/quiz/check', async (route) => {
          const response = await route.fetch();
          fetched();
          await pending;
          await route.fulfill({ response });
        });
        const first = quiz.questions[0];
        const answer = first.options.find((option) => option.id === first.correctOptionId)!;
        await page
          .locator('.quiz-options')
          .getByRole('button', { name: new RegExp(`^[A-D]\\s*${answer.label}$`) })
          .click();
        await ready;
        await page
          .locator('.sidebar')
          .getByRole('link', { name: 'My lessons', exact: true })
          .click();
        await expect(page).toHaveURL(/\/app\/lessons$/);
        const before = await page.evaluate(() => window.soundProbe.starts);
        const delivered = page.waitForResponse((response) =>
          response.url().endsWith('/quiz/check'),
        );
        release();
        await delivered;
        await page.waitForTimeout(100);
        expect(await page.evaluate(() => window.soundProbe.starts)).toBe(before);
        await page.unroute('**/api/lessons/*/quiz/check');
        await page.goBack();
        await expect(page.locator('.quiz-options')).toBeVisible();
      }
      const submitted = page.waitForResponse(
        (response) =>
          response.url().endsWith('/quiz/submit') && response.request().method() === 'POST',
      );
      for (const [index, question] of quiz.questions.entries()) {
        const answer = question.options.find((option) => option.id === question.correctOptionId)!;
        await page
          .locator('.quiz-options')
          .getByRole('button', { name: new RegExp(`^[A-D]\\s*${answer.label}$`) })
          .click();
        await expect(page.locator('.quiz-feedback.correct')).toBeVisible();
        await page
          .getByRole('button', {
            name: index === quiz.questions.length - 1 ? 'Finish my quiz' : 'Next question',
            exact: true,
          })
          .click();
      }
      expect(await (await submitted).json()).toMatchObject({ score: 100, xpEarned: 130 });
      await expect(
        page.getByRole('heading', { name: 'Look at you, a little wiser.', exact: true }),
      ).toBeVisible();
      expect(await api(page, `/lessons/${id}/progress`)).toMatchObject({
        status: 'COMPLETED',
        progress: 100,
      });
      expect(
        await api(page, `/lessons/${id}/progress`, 'POST', {
          lessonVersion: lesson.lessonVersion,
          sceneId: scene.id,
          result: {
            roundAnswers: scene.rounds.map((round) => ({
              roundId: round.id,
              value: numberRoundAnswer(round),
            })),
          },
          elapsedSeconds: 0,
        }),
      ).toMatchObject({ xpEarned: 0 });
      if (process.env.E2E_SOUNDS === '1') {
        const audio = await page.evaluate(() => window.soundProbe);
        // Start button, takeoff, block pickup, wrong answer, bridge, quiz and victory.
        for (const frequency of [520, 220, 1047, 330, 392, 659])
          expect(audio.frequencies).toContain(frequency);
        expect(audio.starts).toBeGreaterThan(25);
        expect(audio.peak).toBeGreaterThan(0.001);
        expect(audio.contexts).toBe(1);
        await page.getByLabel('Interface language', { exact: true }).selectOption('en-zh');
        await expect(page.locator('.app-shell')).toHaveAttribute('data-ui-language', 'en-zh');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Sound settings · 音效设置', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Sound settings · 音效设置' })).toContainText(
          '轻快游戏音效',
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        await page.screenshot({ path: '.local/sounds/mobile-bilingual.png', fullPage: true });
      }
      expect(errors).toEqual([]);
    } finally {
      if (userId) await run('DELETE FROM users WHERE id=?', [userId]);
    }
  });
}
