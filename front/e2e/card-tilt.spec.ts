import { test, expect } from '@playwright/test';

for (const path of ['/', '/es']) {
  test(`homepage card tilts and resets in ${path === '/es' ? 'Spanish' : 'English'}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(path);
    const tilt = page.locator('div[style*="perspective"]').first();
    const animated = tilt.locator(':scope > div');
    await expect(tilt).toBeVisible();
    const bounds = (await tilt.boundingBox())!;
    await tilt.hover({ force: true, position: { x: bounds.width * 0.8, y: bounds.height * 0.25 } });
    await expect.poll(() => animated.evaluate(element => element.style.transform)).toMatch(/rotate[XY]\((?!0deg)[^)]*deg\)/);
    await page.mouse.move(0, 0);
    await expect.poll(() => animated.evaluate(element => element.style.transform)).toBe('none');
  });
}

test('Spanish homepage respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/es');
  const tilt = page.locator('div[style*="perspective"]').first();
  const animated = tilt.locator(':scope > div');
  await tilt.hover({ force: true, position: { x: 30, y: 30 } });
  await expect(animated).toHaveCSS('transform', 'none');
});
