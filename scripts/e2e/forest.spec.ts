import { expect, test, type Page } from '@playwright/test';

// Exercise actual stored AI lessons without asking a provider to generate test content.
// Supply a NUMBER_GAME-only subtraction lesson and an addition + MATCHING lesson.
const addition = process.env.E2E_FOREST_ADDITION_ID;
const subtraction = process.env.E2E_FOREST_SUBTRACTION_ID;
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
async function setup(page: Page, source: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@example.com');
  await page.getByLabel('Password', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const original = await api(page, '/preferences');
  await api(page, '/preferences', 'PATCH', { uiLanguage: 'en' });
  const { id } = await api(page, '/lessons/' + source + '/duplicate', 'POST');
  await api(page, '/lessons/' + id, 'PATCH', { title: '2D forest verification ' + Date.now() });
  await page.goto('/app/lesson/' + id);
  await expect(page.locator('.forest-game')).toBeVisible();
  return { id, original };
}
async function position(page: Page) {
  return page.locator('.forest-mascot').evaluate((element) => {
    const transform = element.getAttribute('transform')!;
    const numbers = transform.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!;
    return { x: Number(numbers[1]) - 24, y: Number(numbers[2]) - 32 };
  });
}
async function move(page: Page, target: number, jump = false) {
  const start = await position(page);
  const right = start.x < target;
  const key = right ? 'ArrowRight' : 'ArrowLeft';
  if (jump) await page.keyboard.down('Space');
  await page.keyboard.down(key);
  try {
    await expect
      .poll(
        async () => {
          const { x } = await position(page);
          return right ? x >= target : x <= target;
        },
        { intervals: [16], timeout: 7000 },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
    if (jump) await page.keyboard.up('Space');
  }
}
async function climbAndCollect(page: Page) {
  await page.locator('.forest-game').focus();
  await move(page, 790);
  await move(page, 205);
  await move(page, 310, true);
  await expect.poll(async () => Math.round((await position(page)).y)).toBe(346);
  await move(page, 380);
  await move(page, 495, true);
  await expect.poll(async () => Math.round((await position(page)).y)).toBe(266);
  await move(page, 610);
  await move(page, 725);
  await expect.poll(async () => Math.round((await position(page)).y)).toBe(346);
}

test('2D forest plays every mission, physically exits, saves completion and XP once', async ({
  page,
}) => {
  test.skip(!addition, 'Set E2E_FOREST_ADDITION_ID to an actual generated lesson.');
  test.setTimeout(150000);
  const { id, original } = await setup(page, addition!);
  try {
    const lesson = await api(page, '/lessons/' + id);
    const scene = lesson.definition.scenes[0];
    expect(scene.type).toBe('NUMBER_GAME');
    await page.getByRole('button', { name: 'Let’s play!', exact: true }).click();
    const desktopView = await page.locator('.forest-landscape').getAttribute('viewBox');
    await page.keyboard.down('ArrowRight');
    await expect.poll(() => page.locator('.forest-mascot').getAttribute('data-gait')).toBe('walk');
    const firstFrame = await page.locator('.forest-mascot').getAttribute('data-frame');
    await expect
      .poll(() => page.locator('.forest-mascot').getAttribute('data-frame'))
      .not.toBe(firstFrame);
    await page.keyboard.up('ArrowRight');
    await expect.poll(() => page.locator('.forest-mascot').getAttribute('data-gait')).toBe('idle');
    for (const [index, round] of scene.rounds.entries()) {
      await climbAndCollect(page);
      expect(await page.locator('.forest-landscape').getAttribute('viewBox')).toBe(desktopView);
      const build = page.getByRole('button', { name: 'Build the bridge', exact: true });
      await expect(build).toBeEnabled();
      await build.click();
      if (index === 0) {
        await page.locator('.forest-answer-options button').last().click();
        await expect(page.locator('.forest-answer-feedback')).toContainText('try again');
        await expect(page.locator('.forest-bridge')).not.toHaveClass(/built/);
      }
      await page
        .getByRole('button', { name: `Build with ${round.left + round.right} blocks`, exact: true })
        .click();
      await expect(page.locator('.forest-bridge')).toHaveClass(/built/);
      await expect(page.locator('.forest-level-win')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Next discovery', exact: true }),
      ).toBeDisabled();
      await page.keyboard.down('ArrowRight');
      await expect(page.locator('.forest-level-win')).toBeVisible();
      await page.keyboard.up('ArrowRight');
      await page
        .getByRole('button', {
          name: index === scene.rounds.length - 1 ? 'Open the treasure' : 'Next level',
          exact: true,
        })
        .click();
    }
    await expect(page.locator('.forest-victory')).toBeVisible();
    await page.getByRole('button', { name: 'Next discovery', exact: true }).click();
    await expect(page.locator('.game-welcome')).toBeVisible();
    await page.getByRole('button', { name: 'Let’s play!', exact: true }).click();
    // Play the deterministic shuffled board, using its recorded seed just as SSR does.
    const match = lesson.definition.scenes[1];
    const cards = match.pairs.flatMap((pair: { id: string }) => [pair.id, pair.id]);
    let seed = [...match.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
    for (let i = cards.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    for (const [pairIndex, pair] of match.pairs.entries()) {
      for (const [index, id] of cards.entries())
        if (id === pair.id) await page.locator('.memory-card').nth(index).click();
      if (pairIndex < match.pairs.length - 1)
        await expect
          .poll(() => page.locator('.memory-card.matched').count())
          .toBe((pairIndex + 1) * 2);
      else await expect(page.locator('.game-victory')).toBeVisible();
    }
    await expect(page.locator('.game-victory')).toBeVisible();
    const progressResponse = page.waitForResponse(
      (r) => r.url().endsWith('/progress') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Finish my adventure', exact: true }).click();
    const saved = await (await progressResponse).json();
    expect(saved).toMatchObject({ lessonCompleted: true, progress: 100, xpEarned: 50 });
    expect(await api(page, '/lessons/' + id + '/progress')).toMatchObject({
      status: 'COMPLETED',
      progress: 100,
    });
    const again = await api(page, '/lessons/' + id + '/progress', 'POST', {
      lessonVersion: lesson.lessonVersion,
      sceneId: match.id,
      result: { matchedIds: match.pairs.map((pair: { id: string }) => pair.id) },
      elapsedSeconds: 0,
    });
    expect(again.xpEarned).toBe(0);
  } finally {
    await api(page, '/lessons/' + id, 'DELETE');
    await api(page, '/preferences', 'PATCH', { uiLanguage: original.uiLanguage });
  }
});

test('forest pause, HUD focus, touch movement, bilingual view and zero subtraction stay playable', async ({
  page,
}) => {
  test.skip(!subtraction, 'Set E2E_FOREST_SUBTRACTION_ID to an actual generated lesson.');
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { id, original } = await setup(page, subtraction!);
  try {
    const lesson = await api(page, '/lessons/' + id);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('button', { name: 'Let’s play!', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Let’s play!', exact: true }).click();
    // Walking feedback is essential gameplay even when decorative motion is reduced.
    await page.keyboard.down('ArrowRight');
    await expect.poll(() => page.locator('.forest-mascot').getAttribute('data-gait')).toBe('walk');
    const reducedMotionFrame = await page.locator('.forest-mascot').getAttribute('data-frame');
    await expect
      .poll(() => page.locator('.forest-mascot').getAttribute('data-frame'), { timeout: 1500 })
      .not.toBe(reducedMotionFrame);
    await page.keyboard.up('ArrowRight');
    await page.getByRole('button', { name: 'Restart level', exact: true }).click();
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement?.className))
      .toBe('forest-game');
    await move(page, 150);
    await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
    await move(page, 180);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const paused = await position(page);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(160);
    await page.keyboard.up('ArrowRight');
    expect(await position(page)).toEqual(paused);
    await page
      .locator('.forest-tools')
      .getByRole('button', { name: 'Resume', exact: true })
      .click();
    await move(page, 210);
    await page.locator('.forest-tools').getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Forest hint' })).toBeVisible();
    await page.locator('.forest-tools').getByRole('button', { name: 'Hint', exact: true }).click();
    await move(page, 230);
    // A held pointer drives touch controls and releases after pointerup.
    const right = page.getByRole('button', { name: 'Move right', exact: true });
    await right.scrollIntoViewIfNeeded();
    const touchBounds = await right.boundingBox();
    await page.mouse.move(
      touchBounds!.x + touchBounds!.width / 2,
      touchBounds!.y + touchBounds!.height / 2,
    );
    await page.mouse.down();
    await expect.poll(async () => (await position(page)).x).toBeGreaterThan(250);
    await page.mouse.up();
    await page.getByRole('button', { name: 'Restart level', exact: true }).click();
    for (const [index, round] of lesson.definition.scenes[0].rounds.entries()) {
      await climbAndCollect(page);
      for (let n = 0; n < round.right; n++)
        await page.getByRole('button', { name: /^Take away one block/ }).click();
      await page.getByRole('button', { name: 'Build the bridge', exact: true }).click();
      await page
        .getByRole('button', { name: `Build with ${round.left - round.right} blocks`, exact: true })
        .click();
      await page.keyboard.down('ArrowRight');
      await expect(page.locator('.forest-level-win')).toBeVisible();
      await page.keyboard.up('ArrowRight');
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      const next = page.getByRole('button', {
        name:
          index === lesson.definition.scenes[0].rounds.length - 1
            ? 'Open the treasure'
            : 'Next level',
        exact: true,
      });
      await expect(next).toBeEnabled();
      await next.click();
    }
    await expect(page.locator('.forest-victory')).toBeVisible();
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Interface language', exact: true })
      .selectOption('en-zh');
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.locator('.forest-name .localized-zh')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      .toBe(false);
    const sprite = await page.locator('.forest-walk-sprite').evaluate((element) => {
      // SVG bounding boxes include the clipped atlas. Measure the visible frame.
      const sprite = element as SVGSVGElement;
      const view = sprite.viewBox.baseVal;
      const transform = sprite.getScreenCTM()!;
      const start = new DOMPoint(view.x, view.y).matrixTransform(transform);
      const end = new DOMPoint(view.x + view.width, view.y + view.height).matrixTransform(
        transform,
      );
      return { x: Math.min(start.x, end.x), width: Math.abs(end.x - start.x) };
    });
    const world = await page.locator('.forest-world').boundingBox();
    expect(sprite.x).toBeGreaterThanOrEqual(world!.x);
    expect(sprite.x + sprite.width).toBeLessThanOrEqual(world!.x + world!.width);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await page.locator('.forest-move-controls .forest-control').last().scrollIntoViewIfNeeded();
    const touchControl = await page
      .locator('.forest-move-controls .forest-control')
      .last()
      .boundingBox();
    const beforeTouch = (await position(page)).x;
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        {
          x: touchControl!.x + touchControl!.width / 2,
          y: touchControl!.y + touchControl!.height / 2,
        },
      ],
    });
    await expect.poll(async () => (await position(page)).x).toBeGreaterThan(beforeTouch + 20);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
    await page.screenshot({ path: '.local/forest-mobile.png', fullPage: true });
  } finally {
    await api(page, '/lessons/' + id, 'DELETE');
    await api(page, '/preferences', 'PATCH', { uiLanguage: original.uiLanguage });
  }
});
