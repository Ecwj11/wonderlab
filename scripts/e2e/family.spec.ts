import { test, expect } from '@playwright/test';

test('family registration, child controls, admin trial and paid activation', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext();
  const parent = await context.newPage();
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const childContext = await browser.newContext();
  const child = await childContext.newPage();
  const email = `family-e2e-${Date.now()}@example.com`;
  const familyName = `E2E Tan Family ${Date.now()}`;
  try {
    parent.setDefaultTimeout(15000);
    admin.setDefaultTimeout(15000);
    child.setDefaultTimeout(15000);
    await parent.goto('/parent/login', { waitUntil: 'domcontentloaded' });
    await parent.getByRole('button', { name: 'Create a family account', exact: true }).click();
    await parent.getByLabel('Your name', { exact: true }).fill('Test Parent');
    await parent.getByLabel('Family name', { exact: true }).fill(familyName);
    await parent.getByLabel('Email address', { exact: true }).fill(email);
    await parent.getByLabel('Password', { exact: true }).fill('FamilyPassword123!');
    await parent.getByRole('button', { name: 'Create family account', exact: true }).click();
    await expect(parent).toHaveURL(/\/parent$/);
    await expect(
      parent.getByRole('heading', { name: 'A little learning, every day.' }),
    ).toBeVisible();
    const family = await parent.evaluate(async () => (await fetch('/api/parent/dashboard')).json());
    expect(family.access.status).toBe('TRIALING');
    await parent.getByRole('link', { name: 'Manage children', exact: true }).click();
    await parent.getByRole('button', { name: 'Add child', exact: true }).click();
    await parent.getByLabel('Child’s name', { exact: true }).fill('Explorer Alex');
    await parent.getByLabel('School level', { exact: true }).fill('Primary 4');
    await parent.locator('input[name=username]').fill('alex');
    await parent.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await parent.getByRole('button', { name: 'Create child profile', exact: true }).click();
    await expect(parent.getByRole('heading', { name: 'Explorer Alex' })).toBeVisible();
    await parent.getByRole('link', { name: 'Subscription', exact: true }).click();
    await parent
      .getByRole('button', { name: /Request/ })
      .first()
      .click();
    await expect(parent.getByText(/Awaiting activation/)).toBeVisible();

    await admin.goto('/admin/login');
    await admin.getByLabel('Email address', { exact: true }).fill('admin@example.com');
    await admin.getByLabel('Password', { exact: true }).fill('qwer1234!');
    await admin.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(admin).toHaveURL(/\/admin$/);
    await admin.getByRole('link', { name: 'Families', exact: true }).click();
    await admin.getByRole('textbox', { name: 'Search families' }).fill(email);
    await admin.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(admin.getByRole('row').filter({ hasText: email })).toHaveCount(1);
    await admin
      .getByRole('row')
      .filter({ hasText: email })
      .getByRole('button', { name: 'Manage family', exact: true })
      .click();
    await admin.locator('input[name=trialDays]').fill('0');
    await admin.getByRole('button', { name: 'Save family access', exact: true }).click();
    await expect(admin.getByText('Family access updated.', { exact: true })).toBeVisible();
    await parent.reload();
    await expect(parent.getByText('Access expired', { exact: true }).first()).toBeVisible();
    const access = await parent.evaluate(async () => (await fetch('/api/learning-access')).json());
    expect(access.canLearn).toBe(false);

    await admin.getByRole('link', { name: 'Subscriptions', exact: true }).click();
    const row = admin.getByRole('row').filter({ hasText: email });
    await row.getByRole('button', { name: 'Review & activate', exact: true }).click();
    await admin.getByLabel('Payment arrangements have been confirmed').check();
    await admin.getByRole('button', { name: 'Activate paid period', exact: true }).click();
    await expect(admin.getByText('Subscription activated.', { exact: false })).toBeVisible();
    await parent.reload();
    expect(
      (await parent.evaluate(async () => (await fetch('/api/learning-access')).json())).status,
    ).toBe('ACTIVE');

    await child.goto('/child/login');
    await child.getByLabel('Family code', { exact: true }).fill(family.family.code);
    await child.getByLabel('Your username', { exact: true }).fill('alex');
    await child.getByLabel('Passcode', { exact: true }).fill('qwer1234!');
    await child.getByRole('button', { name: 'Let’s play', exact: true }).click();
    await expect(child).toHaveURL(/\/app$/);
    await child.goto('/app/create');
    await expect(
      child.getByRole('heading', { name: 'Ask your parent to create a lesson' }),
    ).toBeVisible();
    await child.goto('/app/library', { waitUntil: 'domcontentloaded' });
    await expect(child.locator('.lesson-card').first()).toBeVisible();
    expect(await child.evaluate(async () => (await fetch('/api/parent/billing')).status)).toBe(403);
    await child.goto('/app/lesson/5e7f0574-80ea-4f02-9df0-42eade6dfddb', {
      waitUntil: 'domcontentloaded',
    });
    await expect(child.locator('.subject-adventure-game')).toBeVisible();
    await child.getByRole('button', { name: 'Start adventure', exact: true }).click();
    await child.locator('.subject-adventure-game').focus();
    const before = await child.locator('.subject-adventure-mascot').getAttribute('transform');
    await child.keyboard.down('ArrowRight');
    await expect
      .poll(async () => child.locator('.subject-adventure-mascot').getAttribute('transform'))
      .not.toBe(before);
    await child.keyboard.up('ArrowRight');
    await parent.goto('/parent/children');
    await parent.getByRole('button', { name: 'Pause learning', exact: true }).click();
    await expect(parent.getByText('Child learning paused.', { exact: true })).toBeVisible();
    await expect(child.getByRole('heading', { name: 'Time for a little break' })).toBeVisible({
      timeout: 20000,
    });
    const blocked = await child.evaluate(async () => (await fetch('/api/lessons')).status);
    expect(blocked).toBe(403);
    await parent.screenshot({ path: 'frontend/artifacts/family-children.png', fullPage: true });
    await admin.screenshot({ path: 'frontend/artifacts/family-subscriptions.png', fullPage: true });
  } finally {
    await context.close();
    await adminContext.close();
    await childContext.close();
  }
});
