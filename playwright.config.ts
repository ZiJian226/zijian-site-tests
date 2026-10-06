import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error(
    'BASE_URL is not set. Run e.g.: BASE_URL=http://localhost:8000 npm test',
  );
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
