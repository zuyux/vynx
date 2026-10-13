import { test, expect } from '@playwright/test';

for (const signedIn of [false, true]) {
  test(`home header shows ${signedIn ? 'Profile for a restored session' : 'Connect without a session'}`, async ({ page }) => {
    let release!: () => void;
    const sessionReady = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/auth/session', async route => {
      await sessionReady;
      await route.fulfill({ json: { wallet: signedIn ? '11111111111111111111111111111111' : null, alias: signedIn ? 'google_creator' : null } });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Checking session', exact: true })).toBeDisabled();
    release();
    if (signedIn) {
      const profile = page.getByRole('link', { name: 'Profile', exact: true });
      await expect(profile).toHaveAttribute('href', '/dashboard/card');
      await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toHaveCount(0);
      await expect(page).toHaveURL('/');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(profile).toBeVisible();
      for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(profile).toBeVisible();
        const bounds = (await profile.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      }
    } else {
      const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
      await expect(connect).toBeEnabled();
      await expect(page.getByRole('link', { name: 'Profile', exact: true })).toHaveCount(0);
      await connect.click();
      await expect(page.getByRole('dialog', { name: 'Sign in', exact: true })).toBeVisible();
    }
  });
}
