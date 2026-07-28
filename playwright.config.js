import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://kaiserwhalemarketing.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list']],
});
