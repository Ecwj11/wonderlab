import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, email = 'student@example.com') {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('qwer1234!');
  await page.getByRole('button', { name: 'Let’s explore' }).click();
  await expect(page).toHaveURL(email.startsWith('admin') ? /\/admin$/ : /\/app$/);
  await expect(page.locator('.loading')).toHaveCount(0);
}
async function generate(page: Page, history = false) {
  await page.goto('/app/create');
  await page
    .getByLabel('Give your adventure a title')
    .fill(history ? 'Kemerdekaan ' + Date.now() : 'Fractions ' + Date.now());
  await page
    .getByRole('combobox', { name: 'Subject', exact: true })
    .selectOption(history ? 'HISTORY' : 'MATHEMATICS');
  if (history)
    await page.getByRole('combobox', { name: 'Lesson language' }).selectOption('Bahasa Melayu');
  await page
    .getByLabel('Your textbook content')
    .fill(
      history
        ? 'Kemerdekaan Tanah Melayu dicapai pada 31 Ogos 1957. Pendudukan Jepun bermula pada 1941 dan tamat pada 1945. Pilihan Raya Persekutuan pertama pada 1955. Malaysia dibentuk pada 16 September 1963.'
        : 'Fractions represent equal parts of a whole. The denominator is the total number of equal parts. One quarter is one of four equal slices, written as 1/4.',
    );
  const request = page.waitForResponse(
    (r) => r.url().endsWith('/api/lessons/generate') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Generate interactive lesson' }).click();
  const queued = await request;
  expect(queued.status()).toBe(202);
  const { jobId } = await queued.json();
  await expect(page.locator('.generation-page')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/lesson\//, { timeout: 30000 });
  await expect(page.locator('.interactive-stage')).toBeVisible();
  const generated = await json(page, '/generation-jobs/' + jobId);
  expect(generated.body.status).toBe('COMPLETED');
  expect(generated.body.agents.map((agent: { role: string }) => agent.role)).toEqual(
    expect.arrayContaining([
      'ANALYST',
      'PLANNER',
      'SCENE_SPECIALIST',
      'QUIZ_SPECIALIST',
      'VALIDATOR',
    ]),
  );
  expect(
    generated.body.agents.every((agent: { status: string }) => agent.status === 'COMPLETED'),
  ).toBe(true);
  expect(JSON.stringify(generated.body.agents)).not.toContain('correctOptionId');
  return page.url().split('/').pop()!;
}
async function quiz(page: Page, answers: number[]) {
  for (let i = 0; i < answers.length; i++) {
    await page.locator('.quiz-options button').nth(answers[i]).click();
    await expect(page.locator('.quiz-feedback.correct')).toBeVisible();
    await page
      .getByRole('button', { name: i === answers.length - 1 ? 'Finish my quiz' : 'Next question' })
      .click();
  }
}
async function json(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const response = await fetch('/api' + path);
    return { status: response.status, body: await response.json() };
  }, path);
}
test('fractions end to end, persistent XP and same-origin browser API', async ({ page }) => {
  const failures: string[] = [];
  const remote: string[] = [];
  page.on('pageerror', (e) => failures.push(e.message));
  page.on('request', (r) => {
    if (new URL(r.url()).port === '4000') remote.push(r.url());
  });
  await login(page);
  const before = (await json(page, '/auth/me')).body.xp;
  const id = await generate(page);
  await expect(page.getByRole('button', { name: 'Next discovery' })).toBeDisabled();
  await page.getByRole('button', { name: 'Slice 1', exact: true }).click();
  await expect(page.locator('.fraction-number')).toContainText('1');
  await page.getByRole('button', { name: 'Next discovery' }).click();
  await expect(page.locator('.flashcard')).toHaveCount(2);
  for (const card of await page.locator('.flashcard').all()) await card.click();
  await page.getByRole('button', { name: 'Next discovery' }).click();
  await quiz(page, [0, 1, 2]);
  await expect(page.getByText('Adventure completed', { exact: false })).toBeVisible();
  await expect(page.locator('.completion-rewards')).toContainText('+130');
  const progress = await json(page, '/lessons/' + id + '/progress');
  expect(progress.body.status).toBe('COMPLETED');
  expect(progress.body.progress).toBe(100);
  expect((await json(page, '/auth/me')).body.xp - before).toBe(130);
  await page.reload();
  await expect(page.locator('.lesson-completion')).toBeVisible();
  expect((await json(page, '/auth/me')).body.xp - before).toBe(130);
  expect(remote).toEqual([]);
  expect(failures).toEqual([]);
});
test('Malaysia history timeline and Bahasa Melayu quiz', async ({ page }) => {
  await login(page);
  const id = await generate(page, true);
  for (const year of ['1941', '1945', '1955', '1957', '1963'])
    await page.locator('.timeline-track button').filter({ hasText: year }).click();
  await expect(page.locator('.exploration-count')).toHaveText('5 of 5 moments explored');
  await page.getByRole('button', { name: 'Next discovery' }).click();
  await quiz(page, [1, 1]);
  await expect(page.locator('.completion-rewards')).toContainText('+120');
  expect((await json(page, '/lessons/' + id + '/progress')).body.progress).toBe(100);
});
test('access-cookie expiry renews the session without logging out', async ({ page, context }) => {
  await login(page);
  const before = (await context.cookies()).find((c) => c.name === 'wl_refresh')!;
  expect(before.httpOnly).toBe(true);
  await context.clearCookies({ name: 'wl_access' });
  const response = await json(page, '/auth/me');
  expect(response.status).toBe(200);
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'wl_access')).toBeTruthy();
  expect(cookies.find((c) => c.name === 'wl_refresh')?.value).not.toBe(before.value);
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
});
test('student RBAC and admin lesson JSON inspection', async ({ page }) => {
  await login(page);
  expect((await json(page, '/admin/users')).status).toBe(403);
  await login(page, 'admin@example.com');
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'student@example.com' })).toBeVisible();
  await page.goto('/admin/lessons');
  await page.locator('button[title="View JSON"]:enabled').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('lessonSchemaVersion');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/admin/generation-jobs');
  await page
    .locator('tr')
    .filter({ has: page.locator('.admin-status.completed') })
    .getByRole('button', { name: 'Details', exact: true })
    .first()
    .click();
  await expect(page.locator('.generation-agent-inspector')).toBeVisible();
  await expect(page.locator('.agent-task-list')).toBeVisible();
  // A complete game may use one scene: analyst, planner, specialist and validator.
  expect(await page.locator('.agent-task.completed').count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator('.generation-agent-inspector')).toContainText('Validation & assembly');
});
test('mobile and tablet stay within the viewport and navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('.sidebar').getByRole('link', { name: 'Learn', exact: false }).first().click();
  await expect(page).toHaveURL(/\/app\/create$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/app/progress');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/app/profile');
  await expect(page.getByRole('button', { name: 'Save my details' })).toBeVisible();
});
function chapterPdf() {
  const text = 'Fractions are equal parts of a whole. One quarter is one of four equal parts.';
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(content));
    content += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, '0') + ' 00000 n ')
    .join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(content);
}
test('PDF upload extracts textbook text and generates a fraction lesson', async ({ page }) => {
  await login(page);
  await page.goto('/app/create');
  await page.getByRole('button', { name: 'Upload PDF', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'fractions.pdf', mimeType: 'application/pdf', buffer: chapterPdf() });
  await expect(page.locator('.uploaded-file')).toContainText('fractions.pdf');
  await expect(page.locator('.extracted-preview textarea')).toHaveValue(
    /Fractions are equal parts/,
  );
  await page.getByRole('button', { name: 'Generate interactive lesson' }).click();
  await expect(page).toHaveURL(/\/app\/lesson\//, { timeout: 30000 });
  await expect(page.locator('.pizza-svg')).toBeVisible();
});
test('image OCR reads a clear textbook image within its extraction limit', async ({
  page,
  context,
}) => {
  const imagePage = await context.newPage();
  await imagePage.setViewportSize({ width: 1000, height: 500 });
  await imagePage.setContent(
    '<html><body style="background:white;color:black;font:30px Arial;padding:40px;line-height:1.6">Fractions are equal parts of a whole.<br>One quarter is one of four equal parts.<br>The denominator shows the number of parts.</body></html>',
  );
  const buffer = await imagePage.screenshot();
  await imagePage.close();
  await login(page);
  await page.goto('/app/create');
  await page.getByRole('button', { name: 'Upload image', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'fraction-text.png', mimeType: 'image/png', buffer });
  await expect(page.locator('.uploaded-file')).toContainText('fraction-text.png', {
    timeout: 70000,
  });
  await expect(page.locator('.extracted-preview textarea')).toHaveValue(/Fractions/i);
});
