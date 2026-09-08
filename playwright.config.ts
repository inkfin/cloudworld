import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'browser.spec.ts', timeout: 60000,
  workers: 1, use: { channel: 'chrome', headless: true, launchOptions: { args: ['--enable-unsafe-webgpu'] }, baseURL: 'http://localhost:5173' },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
});
