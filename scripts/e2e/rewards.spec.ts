import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { pool, run, transaction } from '../../backend/src/db/pool.js';
import { saveDefinition } from '../../backend/src/services/lessons.js';
test.use({ actionTimeout: 15000 });
async function api(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const res = await fetch('/api' + path);
    if (!res.ok) throw new Error('API error ' + res.status);
    return res.json();
  }, path);
}
test('parent prizes use real learning Stars, fulfilment, refunds and accessible bilingual screens', async ({
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
  const lessonId = randomUUID();
  const screenshots = '.local/rewards-e2e';
  await mkdir(screenshots, { recursive: true });
  try {
    await parent.goto('/parent/login');
    await parent.getByRole('button', { name: 'Create a family account', exact: true }).click();
    await parent.getByLabel('Your name', { exact: true }).fill('Rewards Test Parent');
    await parent.getByLabel('Family name', { exact: true }).fill('Rewards Verification Family');
    await parent
      .getByLabel('Email address', { exact: true })
      .fill('reward-e2e-' + unique + '@example.com');
    await parent.getByLabel('Password', { exact: true }).fill('qwer1234!Long');
    await parent.getByRole('button', { name: 'Create family account', exact: true }).click();
    await expect(parent).toHaveURL(/\/parent$/);
    parentId = (await api(parent, '/auth/me')).id;
    await parent.getByRole('link', { name: 'Children', exact: true }).click();
    await parent.getByRole('button', { name: 'Add child', exact: true }).click();
    await parent.getByLabel('Child’s name', { exact: true }).fill('Prize Explorer');
    await parent.getByLabel('School level', { exact: true }).fill('Primary 4');
    await parent.locator('input[name=username]').fill('explorer');
    await parent.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await parent.getByRole('button', { name: 'Create child profile', exact: true }).click();
    await expect(parent.getByRole('heading', { name: 'Prize Explorer' })).toBeVisible();
    const family = await api(parent, '/parent/dashboard');
    childId = family.children[0].id;
    await parent.getByRole('link', { name: 'Family prizes', exact: true }).click();
    await expect(parent).toHaveURL(/\/parent\/rewards$/);
    await parent.locator('input[name=lessonStars]').fill('6');
    await parent.locator('input[name=correctAnswerStars]').fill('1');
    await parent.locator('input[name=perfectQuizBonusStars]').fill('3');
    await parent.getByRole('button', { name: 'Save earning rules', exact: true }).click();
    await parent
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirm changes', exact: true })
      .click();
    await expect(parent.getByText('Earning rules saved.', { exact: true })).toBeVisible();
    const add = async (name: string, cost: number, emoji: string) => {
      await parent.getByRole('button', { name: 'Add prize', exact: true }).click();
      const editor = parent.getByRole('dialog');
      await editor.locator('input[name=name]').fill(name);
      await editor
        .locator('textarea[name=description]')
        .fill('Enjoy this together with your family.');
      await editor.locator('select[name=emoji]').selectOption(emoji);
      await editor.locator('input[name=starCost]').fill(String(cost));
      await editor.getByRole('button', { name: 'Save prize', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await expect(parent.getByTestId('parent-prize-card').filter({ hasText: name })).toBeVisible();
    };
    await add('Ice cream outing', 4, '🍦');
    await add('Family movie night', 3, '🎬');
    await parent.screenshot({ path: screenshots + '/parent-desktop.png', fullPage: true });

    // A known, schema-validated lesson fixture. Currency still comes exclusively
    // from the real server learning API; no fake wallet or AI budget is involved.
    await transaction(async (db) => {
      await run(
        "INSERT INTO lessons(id,user_id,title,subject_id,language,school_level,status,source_content) VALUES(?,?,?,'MATHEMATICS','English','Primary 4','READY','One quarter of a pizza')",
        [lessonId, childId, 'Fractions and family prizes'],
        db,
      );
      await saveDefinition(
        lessonId,
        {
          lessonSchemaVersion: 1,
          title: 'Fractions and family prizes',
          subject: 'MATHEMATICS',
          language: 'English',
          objectives: ['Recognise one quarter'],
          scenes: [
            {
              id: 'pizza',
              type: 'FRACTION_PIZZA',
              title: 'Take one quarter',
              explanation: 'Select one of four equal pieces.',
              instructions: 'Take one quarter.',
              parts: 4,
              target: 1,
            },
            {
              id: 'quiz',
              type: 'QUIZ',
              title: 'A fraction quiz',
              explanation: 'Choose the fraction.',
              questions: [
                {
                  id: 'quarter',
                  prompt: 'One piece out of four equal pieces is…',
                  options: [
                    { id: 'a', label: 'One quarter' },
                    { id: 'b', label: 'One half' },
                  ],
                  correctOptionId: 'a',
                  explanation: 'One of four equal pieces is one quarter.',
                },
              ],
            },
          ],
        },
        db,
      );
    });
    await child.goto('/child/login');
    await child.getByLabel('Family code', { exact: true }).fill(family.family.code);
    await child.getByLabel('Your username', { exact: true }).fill('explorer');
    await child.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await child.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(child).toHaveURL(/\/app$/);
    await child.goto('/app/rewards');
    const wallet = child.getByTestId('stars-wallet').locator('strong');
    await expect(wallet).toHaveText('0');
    await expect(
      child
        .getByTestId('child-prize-card')
        .getByRole('button', { name: 'Request prize', exact: true })
        .first(),
    ).toBeDisabled();
    await child.goto('/app/lesson/' + lessonId);
    await child.getByRole('button', { name: 'Slice 1', exact: true }).click();
    await child.getByRole('button', { name: 'Next discovery', exact: true }).click();
    await child
      .locator('.quiz-options')
      .getByRole('button', { name: /One quarter/ })
      .click();
    await child.getByRole('button', { name: 'Finish my quiz', exact: true }).click();
    await expect(
      child.getByRole('heading', { name: 'Look at you, a little wiser.', exact: true }),
    ).toBeVisible();
    const progress = await api(child, '/auth/me');
    expect(progress.xp).toBe(110);
    expect(progress.level).toBe(1);
    await child.goto('/app/rewards');
    await expect(wallet).toHaveText('10');
    const requestPrize = async (name: string) => {
      await child
        .getByTestId('child-prize-card')
        .filter({ hasText: name })
        .getByRole('button', { name: 'Request prize', exact: true })
        .click();
      await child.getByTestId('confirm-redeem').click();
      await expect(child.getByRole('dialog')).toHaveCount(0);
      await expect(
        child
          .getByTestId('child-prize-request')
          .filter({ hasText: name })
          .getByText('Waiting for your parent', { exact: true })
          .first(),
      ).toBeVisible();
    };
    await requestPrize('Ice cream outing');
    await expect(wallet).toHaveText('6');
    await parent.reload();
    const ice = parent.getByTestId('parent-prize-request').filter({ hasText: 'Ice cream outing' });
    await ice.getByRole('button', { name: 'Mark given', exact: true }).click();
    await parent
      .getByRole('dialog')
      .getByRole('button', { name: 'Mark given', exact: true })
      .click();
    await expect(parent.getByRole('dialog')).toHaveCount(0);
    await child.reload();
    await expect(
      child
        .getByTestId('child-prize-request')
        .filter({ hasText: 'Ice cream outing' })
        .getByText('Given', { exact: true }),
    ).toBeVisible();
    await expect(wallet).toHaveText('6');
    await requestPrize('Family movie night');
    await expect(wallet).toHaveText('3');
    await parent.reload();
    await parent
      .getByTestId('parent-prize-request')
      .filter({ hasText: 'Family movie night' })
      .getByRole('button', { name: 'Decline', exact: true })
      .click();
    await parent
      .getByRole('dialog')
      .getByRole('button', { name: 'Decline and return Stars', exact: true })
      .click();
    await expect(parent.getByRole('dialog')).toHaveCount(0);
    await child.reload();
    await expect(wallet).toHaveText('6');
    await requestPrize('Family movie night');
    await expect(wallet).toHaveText('3');
    await child
      .getByTestId('child-prize-request')
      .filter({ hasText: 'Family movie night' })
      .getByRole('button', { name: 'Cancel request', exact: true })
      .click();
    await child
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel and return Stars', exact: true })
      .click();
    await expect(child.getByRole('dialog')).toHaveCount(0);
    await expect(wallet).toHaveText('6');
    expect(await api(child, '/auth/me')).toMatchObject({ xp: 110, level: 1 });
    // Lose a real committed response, cancel that request from history, then
    // replay its persisted UUID. The UI must not claim a new spend occurred.
    await child.route('**/api/rewards/*/redeem', async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('failed');
    });
    const movie = child.getByTestId('child-prize-card').filter({ hasText: 'Family movie night' });
    await movie.getByRole('button', { name: 'Request prize', exact: true }).click();
    await child.getByTestId('confirm-redeem').click();
    await expect(child.getByRole('dialog').getByRole('alert')).toBeVisible();
    await child.unroute('**/api/rewards/*/redeem');
    await child
      .getByRole('dialog')
      .getByRole('button', { name: 'Keep saving', exact: true })
      .click();
    await child.reload();
    await expect(wallet).toHaveText('3');
    await child
      .getByTestId('child-prize-request')
      .filter({ hasText: 'Family movie night' })
      .getByRole('button', { name: 'Cancel request', exact: true })
      .click();
    await child
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel and return Stars', exact: true })
      .click();
    await expect(child.getByRole('dialog')).toHaveCount(0);
    await expect(wallet).toHaveText('6');
    await movie.getByRole('button', { name: 'Request prize', exact: true }).click();
    await child.getByTestId('confirm-redeem').click();
    await expect(
      child.getByText(
        'This earlier request has already been resolved. No extra Stars were spent.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(wallet).toHaveText('6');
    await requestPrize('Family movie night');
    await expect(wallet).toHaveText('3');
    await child.screenshot({ path: screenshots + '/child-desktop.png', fullPage: true });
    for (const page of [parent, child]) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByLabel('Interface language', { exact: true }).selectOption('en-zh');
      const shell = page.locator(page === parent ? '.family-shell' : '.app-shell');
      await expect(shell).toHaveAttribute('data-ui-language', 'en-zh');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
      await page.screenshot({
        path: screenshots + (page === parent ? '/parent-mobile.png' : '/child-mobile.png'),
        fullPage: true,
      });
    }
    // Trial expiry permits accessing previously earned prizes, including a fresh login.
    await run(
      'UPDATE families SET trial_ends_at=UTC_TIMESTAMP()-INTERVAL 1 DAY WHERE parent_id=?',
      [parentId],
    );
    await childContext.clearCookies();
    await child.goto('/child/login');
    await child.getByLabel('Family code', { exact: true }).fill(family.family.code);
    await child.getByLabel('Your username', { exact: true }).fill('explorer');
    await child.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await child.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(child).toHaveURL(/\/app$/);
    await child.goto('/app/rewards');
    await expect(wallet).toHaveText('3');
    await expect(child.locator('.family-learning-gate')).toHaveCount(0);
  } finally {
    if (childId) await run('DELETE FROM users WHERE id=?', [childId]);
    if (parentId) await run('DELETE FROM users WHERE id=?', [parentId]);
    await childContext.close();
    await parentContext.close();
    await pool.end();
  }
});
