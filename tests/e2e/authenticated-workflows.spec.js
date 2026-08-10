import { test, expect } from '@playwright/test';

const credentials = {
  admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD, portal: 'Admin Portal', dashboard: '/admin' },
  director: { email: process.env.E2E_DIRECTOR_EMAIL, password: process.env.E2E_DIRECTOR_PASSWORD, portal: 'Director Portal', dashboard: '/director' },
  marketing: { email: process.env.E2E_MARKETING_EMAIL, password: process.env.E2E_MARKETING_PASSWORD, portal: 'Marketing Portal', dashboard: '/marketing' },
};

const hasCredentials = (role) => Boolean(credentials[role].email && credentials[role].password);

async function login(page, role) {
  const account = credentials[role];
  await page.goto('/login');
  await page.locator('#kw-login-email').fill(account.email);
  await page.locator('#kw-login-password').fill(account.password);
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page.getByRole('heading', { name: account.portal })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${account.dashboard}$`));
}

async function logout(page) {
  const profile = page.locator('.user-profile-pill');
  await profile.click();
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function expectContinuousTyping(page, field, text) {
  await field.click();
  const originalNode = await field.elementHandle();
  for (const character of text) {
    await page.keyboard.insertText(character);
    await expect(field).toBeFocused();
    expect(await field.evaluate((node, initialNode) => node === initialNode, originalNode)).toBe(true);
  }
  await expect(field).toHaveValue(text);
}

test('production login page renders without a blank screen', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  await expect(page.locator('#kw-login-email')).toBeVisible();
  await expect(page.locator('#kw-login-password')).toBeVisible();
  await expect(page.locator('body')).not.toBeEmpty();
});

test('invalid login displays a visible error', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#kw-login-email').fill('invalid.e2e@kaiserwhale.com');
  await page.locator('#kw-login-password').fill('invalid-e2e-password');
  await page.getByRole('button', { name: /login/i }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('forgot-password help modal opens and closes', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: /forgot password/i }).click();
  await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeHidden();
});

test('shared modal portal retains input focus and DOM identity while typing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const consoleErrors = [];
  const typingRequests = [];
  let captureTypingRequests = false;
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', (request) => { if (captureTypingRequests && ['fetch', 'xhr'].includes(request.resourceType())) typingRequests.push(request.url()); });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 768, height: 1024 }, { width: 430, height: 932 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot password/i }).click();
    const email = page.locator('#kw-reset-email');
    captureTypingRequests = true;
    await expectContinuousTyping(page, email, 'continuous.1234567890தமிழ்@example.com');
    await email.fill('');
    await email.focus();
    await page.evaluate(() => navigator.clipboard.writeText('pasted.focus@example.com'));
    await page.keyboard.press('ControlOrMeta+V');
    await expect(email).toBeFocused();
    await expect(email).toHaveValue('pasted.focus@example.com');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(email).toBeFocused();
    captureTypingRequests = false;
    await page.getByRole('button', { name: 'Close' }).click();
  }
  expect(consoleErrors).toEqual([]);
  expect(typingRequests).toEqual([]);
});

for (const role of Object.keys(credentials)) {
  test.describe(`${role} authenticated navigation`, () => {
    test.skip(!hasCredentials(role), `${role} E2E credentials are not configured`);

    test('login, refresh, direct route, history, and logout', async ({ page }) => {
      const account = credentials[role];
      await login(page, role);
      await page.reload();
      await expect(page.getByRole('heading', { name: account.portal })).toBeVisible();
      await page.goto(account.dashboard);
      await expect(page.getByRole('heading', { name: account.portal })).toBeVisible();
      await page.goBack();
      await page.goForward();
      await expect(page.getByRole('heading', { name: account.portal })).toBeVisible();
      await logout(page);
    });
  });
}

test.describe('role permissions', () => {
  test.skip(!hasCredentials('director'), 'Director E2E credentials are not configured');
  test('Director is redirected away from the Admin portal', async ({ page }) => {
    await login(page, 'director');
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/director$/);
    await logout(page);
  });
});

test.describe('Marketing route permissions', () => {
  test.skip(!hasCredentials('marketing'), 'Marketing E2E credentials are not configured');
  test('Marketing is redirected away from Director and Admin portals', async ({ page }) => {
    await login(page, 'marketing');
    await page.goto('/director');
    await expect(page).toHaveURL(/\/marketing$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/marketing$/);
    await logout(page);
  });
});

test.describe('Marketing form focus stability', () => {
  test.skip(!hasCredentials('marketing'), 'Marketing E2E credentials are not configured');

  test('Follow-up fields retain focus and DOM identity while typing and pasting', async ({ page, context }) => {
    await login(page, 'marketing');
    await page.goto('/marketing/follow-ups');
    await page.getByRole('button', { name: /add follow-up/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Schedule New Follow-up' })).toBeVisible();

    const fields = [
      page.getByLabel('Organization / Person (Optional)'),
      page.getByLabel('Purpose / Notes'),
      page.getByLabel('Internal Notes'),
    ];
    for (const field of fields) {
      await expectContinuousTyping(page, field, 'abcdefghijklmnopqrstuvwxyz1234567890');
      await field.fill('');
    }

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const notes = page.getByLabel('Internal Notes');
    await notes.focus();
    await page.evaluate(() => navigator.clipboard.writeText('Pasted sentence remains focused.'));
    await page.keyboard.press('ControlOrMeta+V');
    await expect(notes).toBeFocused();
    await expect(notes).toHaveValue('Pasted sentence remains focused.');

    await page.getByLabel('Organization / Person (Optional)').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Follow-up Date')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByLabel('Organization / Person (Optional)')).toBeFocused();
  });
});
