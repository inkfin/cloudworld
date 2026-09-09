import { test, expect } from '@playwright/test';

test('WebGPU scene, walking, animal greeting, audio and dialogs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '走进小岛' })).toBeEnabled({ timeout: 45000 });
  const state = () => page.evaluate(() => (window as any).__island);
  expect((await state()).backend).toBe('webgpu');
  expect((await state()).wasm).toBe(true);
  await page.screenshot({ path: '.playwright/landing.png' });
  await page.getByRole('button', { name: '走进小岛' }).click();
  await expect(page.locator('#journal')).toBeVisible();
  const before = (await state()).position;
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(550);
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(800);
  const after = (await state()).position;
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.6);
  await page.evaluate(() => {const c=(window as any).__island.creatures.find((c:any)=>c.kind==='rabbit');(window as any).__islandTest.warp(c.x+1.8,c.z);});
  await expect(page.locator('#interact-button')).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect(page.locator('#journal-count')).toHaveText('1 / 7');
  await page.getByRole('button', { name: '开启海浪与钢琴' }).click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '关闭海浪与钢琴' }).click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: '操作说明' }).click();
  await expect(page.locator('#info-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#info-dialog')).not.toBeVisible();
  await page.screenshot({ path: '.playwright/exploring.png' });
  expect(errors).toEqual([]);
});

test('mobile layout and touch movement', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: '走进小岛' })).toBeEnabled({ timeout: 45000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '.playwright/mobile.png' });
  await page.getByRole('button', { name: '走进小岛' }).tap();
  await expect(page.getByRole('button', { name: '向前', exact: true })).toBeVisible();
  const before = await page.evaluate(() => (window as any).__island.position);
  await page.locator('[data-move="up"]').dispatchEvent('pointerdown', { pointerId: 1 });
  await page.waitForTimeout(500);
  await page.locator('[data-move="up"]').dispatchEvent('pointerup', { pointerId: 1 });
  const after = await page.evaluate(() => (window as any).__island.position);
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(.4);
  await page.screenshot({ path: '.playwright/mobile-exploring.png' });
  await context.close();
});

test('unsupported WebGPU gives a readable message without a WebGL fallback', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/');
  await expect(page.locator('#load-status')).toContainText('这座岛需要 WebGPU');
  await expect(page.locator('#enter-button')).toBeDisabled();
  await expect(page.locator('canvas')).toHaveCount(0);
});
