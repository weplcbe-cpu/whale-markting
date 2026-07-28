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
