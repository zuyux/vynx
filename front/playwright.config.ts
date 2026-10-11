import { defineConfig, devices } from '@playwright/test';

const crossBrowser = process.env.E2E_CROSS_BROWSER === '1';

export default defineConfig({
  testDir: './e2e', testMatch: process.env.E2E_ALIAS_REGISTRY === '1' ? '**/registry.spec.ts' : '**/*.spec.ts', testIgnore: process.env.E2E_ALIAS_REGISTRY === '1' ? [] : ['**/registry.spec.ts'], fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 15_000 },
  use: { baseURL: process.env.E2E_BASE_URL, browserName: 'chromium', trace: 'retain-on-failure', serviceWorkers: 'block' },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: crossBrowser ? [
    { name: 'chrome-desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], browserName: 'firefox' } },
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'], browserName: 'webkit' } },
    { name: 'chrome-mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ] : [{ name: 'chromium' }],
});
