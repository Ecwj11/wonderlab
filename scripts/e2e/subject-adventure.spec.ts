import { expect, test, type Page } from '@playwright/test';
import { loadMathsCatalogue } from '../../backend/src/db/maths-catalogue.js';
import { pool, run } from '../../backend/src/db/pool.js';
import { randomUUID } from 'node:crypto';
test.use({ actionTimeout: 15000 });
test.afterAll(() => pool.end());

// Opt in with real generated lessons; each run plays and deletes private duplicates.
const sources = [
  { subject: 'SCIENCE', theme: 'science', id: process.env.E2E_ADVENTURE_SCIENCE_ID },
  { subject: 'HISTORY', theme: 'history', id: process.env.E2E_ADVENTURE_HISTORY_ID },
  { subject: 'GEOGRAPHY', theme: 'geography', id: process.env.E2E_ADVENTURE_GEOGRAPHY_ID },
  { subject: 'GENERAL', theme: 'general', id: process.env.E2E_ADVENTURE_GENERAL_ID },
  { subject: 'MATHEMATICS-ADD', theme: 'general', id: process.env.E2E_ADVENTURE_MATHS_ADD_ID },
  {
    subject: 'MATHEMATICS-SUBTRACT',
    theme: 'general',
    id: process.env.E2E_ADVENTURE_MATHS_SUBTRACT_ID,
  },
  {
    subject: 'MATHEMATICS-MULTIPLY',
    theme: 'general',
    id: process.env.E2E_ADVENTURE_MATHS_MULTIPLY_ID,
  },
  {
    subject: 'MATHEMATICS-DIVIDE',
    theme: 'general',
    id: process.env.E2E_ADVENTURE_MATHS_DIVIDE_ID,
  },
];
type Pair = { id: string; left: string; right: string };
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
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const original = await api(page, '/preferences');
  await api(page, '/preferences', 'PATCH', { uiLanguage: 'en' });
  return original;
}
async function duplicate(page: Page, source: string) {
  const { id } = await api(page, `/lessons/${source}/duplicate`, 'POST');
  await api(page, `/lessons/${id}`, 'PATCH', {
    title: 'Subject adventure verification ' + Date.now(),
  });
  await page.goto('/app/lesson/' + id);
  await expect(page.locator('.subject-adventure-game')).toBeVisible();
  return { id, lesson: await api(page, '/lessons/' + id) };
}
async function position(page: Page) {
  return page.locator('.subject-adventure-mascot').evaluate((element) => {
    const values = element.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!;
    return { x: Number(values[1]) - 24, y: Number(values[2]) - 32 };
  });
}
async function solve(page: Page, pairs: Pair[]) {
  const dialog = page.locator('.subject-adventure-modal[data-pair-id]');
  const id = await dialog.getAttribute('data-pair-id');
  const pair = pairs.find((pair) => pair.id === id)!;
  await dialog.getByRole('button', { name: pair.right, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function move(page: Page, target: number, pairs: Pair[], jump = false) {
  const right = (await position(page)).x < target;
  const key = right ? 'ArrowRight' : 'ArrowLeft';
  const hold = async () => {
    await page.locator('.subject-adventure-game').focus();
    if (jump) await page.keyboard.down('Space');
    await page.keyboard.down(key);
  };
  const release = async () => {
    await page.keyboard.up(key);
    if (jump) await page.keyboard.up('Space');
  };
  const deadline = Date.now() + 12000;
  await hold();
  try {
    while (Date.now() < deadline) {
      if (await page.locator('.subject-adventure-modal[data-pair-id]').isVisible()) {
        await release();
        await solve(page, pairs);
        await hold();
      }
      const { x } = await position(page);
      if (right ? x >= target : x <= target) return;
      if (target > 1400 && (await page.locator('.subject-adventure-victory').isVisible())) return;
      await page.waitForTimeout(25);
    }
    throw new Error(`Could not reach ${target}: ${JSON.stringify(await position(page))}`);
  } finally {
    await release();
  }
}
async function playWorld(page: Page, pairs: Pair[]) {
  await move(page, 790, pairs);
  await move(page, 205, pairs);
  await move(page, 310, pairs, true);
  await expect
    .poll(async () => {
      if (await page.locator('.subject-adventure-modal[data-pair-id]').isVisible())
        await solve(page, pairs);
      return Math.round((await position(page)).y);
    })
    .toBe(346);
  await move(page, 380, pairs);
  await move(page, 495, pairs, true);
  await expect
    .poll(async () => {
      if (await page.locator('.subject-adventure-modal[data-pair-id]').isVisible())
        await solve(page, pairs);
      return Math.round((await position(page)).y);
    })
    .toBe(266);
  await move(page, 610, pairs);
  await move(page, 725, pairs);
  // The eight-pair schema places its last clue on the third raised platform.
  if (await page.locator('.subject-adventure-modal[data-pair-id]').isVisible())
    await solve(page, pairs);
  await expect(page.locator('.subject-adventure-bridge')).toHaveAttribute('data-built', 'true');
  await expect(page.locator('.subject-adventure-victory')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next discovery', exact: true })).toBeDisabled();
  await move(page, 1410, pairs);
  await expect(page.locator('.subject-adventure-victory')).toBeVisible();
}

for (const source of sources)
  test(`${source.subject} world has missions, a steady camera and a physical exit`, async ({
    page,
  }) => {
    test.skip(!source.id, 'Supply an actual Codex-generated lesson ID.');
    test.setTimeout(120000);
    let temporaryUserId = '';
    let original;
    let copyId = '';
    try {
      if (source.subject.startsWith('MATHEMATICS')) {
        await page.goto('/login');
        const registration = await page.request.post('/api/auth/register', {
          data: {
            name: 'Maths game verification',
            email: `maths-${randomUUID()}@example.com`,
            password: 'qwer1234!Long',
          },
        });
        expect(registration.status()).toBe(201);
        temporaryUserId = (await registration.json()).user.id;
        await page.goto('/app');
        original = await api(page, '/preferences');
        await api(page, '/preferences', 'PATCH', { uiLanguage: 'en' });
        const catalogue = await loadMathsCatalogue();
        for (const grade of [1, 2, 3]) {
          const library = await api(
            page,
            `/library?subject=MATHEMATICS&schoolLevel=Primary%20${grade}&pageSize=100`,
          );
          expect(
            library.data.filter((lesson: { id: string }) =>
              catalogue.some((item) => item.id === lesson.id),
            ),
          ).toHaveLength(32);
        }
        await page.goto('/app/library?subject=MATHEMATICS&search=P1%20Addition');
        await expect(page.locator('.lesson-card')).toHaveCount(9);
        await expect(
          page.getByText('13 adventures to spark your curiosity', { exact: true }),
        ).toBeVisible();
      } else original = await login(page);
      const { id, lesson } = await duplicate(page, source.id!);
      copyId = id;
      const scene = lesson.definition.scenes[0];
      expect(scene.type).toBe('MATCHING');
      await expect(page.locator('.subject-adventure-game')).toHaveAttribute(
        'data-theme',
        source.theme,
      );
      const background = page.locator('.subject-adventure-landscape > image');
      expect(await background.getAttribute('href')).toBe(
        `/games/subject-adventure/${source.theme}.png`,
      );
      await page.getByRole('button', { name: 'Start adventure', exact: true }).click();
      const view = await page.locator('.subject-adventure-landscape').getAttribute('viewBox');
      await page.keyboard.down('ArrowRight');
      await expect(page.locator('.subject-adventure-modal[data-pair-id]')).toBeVisible();
      await page.keyboard.up('ArrowRight');
      const dialog = page.locator('.subject-adventure-modal[data-pair-id]');
      const activeId = await dialog.getAttribute('data-pair-id');
      const active = scene.pairs.find((pair: Pair) => pair.id === activeId)!;
      const wrong = dialog
        .locator('.subject-adventure-choice')
        .filter({ hasNotText: active.right })
        .first();
      await wrong.click();
      await expect(dialog.locator('.subject-adventure-feedback')).toContainText(
        source.subject.startsWith('MATHEMATICS') ? 'Try another answer' : 'Try another meaning',
      );
      await expect(page.locator('.subject-adventure-bridge')).toHaveAttribute(
        'data-built',
        'false',
      );
      await dialog.getByRole('button', { name: 'Close mission', exact: true }).click();
      const stopped = await position(page);
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(120);
      await page.keyboard.up('ArrowRight');
      expect(await position(page)).toEqual(stopped);
      await page.getByRole('button', { name: 'Continue mission', exact: true }).click();
      await solve(page, scene.pairs);
      await playWorld(page, scene.pairs);
      expect(await page.locator('.subject-adventure-landscape').getAttribute('viewBox')).toBe(view);
      await page.screenshot({
        path: `.local/subject-adventure/${source.theme}-victory.png`,
        fullPage: true,
      });
      await page
        .locator('.subject-adventure-victory')
        .getByRole('button', { name: 'Continue learning', exact: true })
        .click();
      for (let tab = 0; tab < 12; tab++) {
        await page.keyboard.press('Tab');
        if (
          await page
            .getByRole('button', { name: 'Next discovery', exact: true })
            .evaluate((element) => element === document.activeElement)
        )
          break;
      }
      await expect(page.getByRole('button', { name: 'Next discovery', exact: true })).toBeFocused();
      const saved = page.waitForResponse(
        (r) => r.url().endsWith('/progress') && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Next discovery', exact: true }).click();
      expect(await (await saved).json()).toMatchObject({ progress: 50, lessonCompleted: false });
      if (source.subject.startsWith('MATHEMATICS')) {
        const catalogue = await loadMathsCatalogue();
        const quiz = catalogue.find((item) => item.id === source.id)!.definition.scenes[1];
        if (quiz.type !== 'QUIZ') throw new Error('Missing maths quiz');
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
          progress: 100,
          status: 'COMPLETED',
        });
        const repeat = await api(page, `/lessons/${id}/progress`, 'POST', {
          lessonVersion: lesson.lessonVersion,
          sceneId: scene.id,
          result: { matchedIds: scene.pairs.map((pair: Pair) => pair.id) },
          elapsedSeconds: 0,
        });
        expect(repeat.xpEarned).toBe(0);
      }
      if (source.subject === 'SCIENCE') {
        const supporting = lesson.definition.scenes[1];
        expect(supporting.type).toBe('INTERACTIVE_DIAGRAM');
        for (const part of supporting.parts)
          await page
            .locator('.diagram-part-list')
            .getByRole('button', { name: part.label, exact: true })
            .click();
        const completed = page.waitForResponse(
          (r) => r.url().endsWith('/progress') && r.request().method() === 'POST',
        );
        await page.getByRole('button', { name: 'Finish my adventure', exact: true }).click();
        expect(await (await completed).json()).toMatchObject({
          progress: 100,
          lessonCompleted: true,
          xpEarned: 50,
        });
        expect(await api(page, `/lessons/${id}/progress`)).toMatchObject({
          progress: 100,
          status: 'COMPLETED',
        });
        const repeat = await api(page, `/lessons/${id}/progress`, 'POST', {
          lessonVersion: lesson.lessonVersion,
          sceneId: supporting.id,
          result: { viewedIds: supporting.parts.map((part: { id: string }) => part.id) },
          elapsedSeconds: 0,
        });
        expect(repeat.xpEarned).toBe(0);
      }
    } finally {
      try {
        if (copyId) await api(page, '/lessons/' + copyId, 'DELETE');
        if (!temporaryUserId && original)
          await api(page, '/preferences', 'PATCH', { uiLanguage: original.uiLanguage });
      } finally {
        if (temporaryUserId) await run('DELETE FROM users WHERE id=?', [temporaryUserId]);
      }
    }
  });

test('adventure walking survives reduced motion, pause, HUD focus and bilingual touch controls', async ({
  page,
}) => {
  const source = sources.find((source) => source.subject === 'GENERAL')!;
  test.skip(!source.id, 'Supply a real general lesson ID.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const original = await login(page);
  let copyId = '';
  try {
    const { id } = await duplicate(page, source.id!);
    copyId = id;
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.getByRole('button', { name: 'Start adventure', exact: true }).click();
    await page.keyboard.down('ArrowLeft');
    const frames = await page.locator('.subject-adventure-mascot').evaluate(async (element) => {
      const seen = new Set<string>();
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (element.getAttribute('data-gait') === 'walk')
            seen.add(element.getAttribute('data-frame')!);
          if (performance.now() - start < 220) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      return [...seen];
    });
    expect(frames.length).toBeGreaterThan(1);
    await page.keyboard.up('ArrowLeft');
    await page.getByRole('button', { name: 'Restart adventure', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const stopped = await position(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(120);
    await page.keyboard.up('ArrowRight');
    expect(await position(page)).toEqual(stopped);
    await page
      .locator('.subject-adventure-tools')
      .getByRole('button', { name: 'Resume', exact: true })
      .click();
    await page
      .locator('.subject-adventure-tools')
      .getByRole('button', { name: 'Hint', exact: true })
      .click();
    await expect(page.getByRole('dialog', { name: 'Hint', exact: true })).toBeVisible();
    await page
      .locator('.subject-adventure-tools')
      .getByRole('button', { name: 'Hint', exact: true })
      .click();
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await position(page)).x).toBeGreaterThan(100);
    await page.keyboard.up('ArrowRight');
    await page.getByRole('button', { name: 'Restart adventure', exact: true }).click();
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.className))
      .toBe('subject-adventure-game');
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await page
      .getByRole('combobox', { name: 'Interface language', exact: true })
      .selectOption('en-zh');
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator('.subject-adventure-name .localized-zh')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      .toBe(false);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const control = page.getByRole('button', { name: 'Move right · 向右移动', exact: true });
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    const before = (await position(page)).x;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }],
    });
    await expect.poll(async () => (await position(page)).x).toBeGreaterThan(before + 20);
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect
      .poll(() => page.locator('.subject-adventure-mascot').getAttribute('data-gait'))
      .toBe('idle');
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
    await page.screenshot({
      path: '.local/subject-adventure/mobile-bilingual.png',
      fullPage: true,
    });
  } finally {
    if (copyId) await api(page, '/lessons/' + copyId, 'DELETE');
    await api(page, '/preferences', 'PATCH', { uiLanguage: original.uiLanguage });
  }
});
