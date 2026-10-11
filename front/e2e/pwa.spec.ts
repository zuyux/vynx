import { test, expect } from './test';

test.use({ serviceWorkers: 'allow' });

test('installable manifest, private cache boundaries, offline recovery, and legacy cleanup', async ({ page, context }) => {
  await page.goto('/offline.html');
  await page.evaluate(async () => {
    await (await caches.open('vynx-static-v2')).put('/private.png', new Response('old private content'));
    await (await caches.open('unrelated-app')).put('/unrelated', new Response('keep'));
  });
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const manifest = await (await page.request.get('/site.webmanifest')).json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', display: 'standalone', lang: 'en' });
  for (const icon of manifest.icons) {
    expect((await page.request.get(icon.src)).ok()).toBe(true);
  }
  const workerResponse = await page.request.get('/sw.js');
  expect(workerResponse.headers()['cache-control']).toContain('no-store');
  await page.evaluate(() => fetch('/api/auth/session'));
  const keys = await page.evaluate(() => caches.keys());
  expect(keys).not.toContain('vynx-static-v2');
  expect(keys).toContain('unrelated-app');
  const paths = await page.evaluate(async () => {
    const requests = await (await caches.open('vynx-pwa-v1')).keys();
    return requests.map(request => new URL(request.url).pathname);
  });
  expect(paths).toContain('/offline.html');
  expect(paths.every(path => path === '/offline.html' || path.startsWith('/_next/static/') || /\/android-chrome-|\/apple-touch-icon/.test(path))).toBe(true);
  expect(paths).not.toContain('/');
  expect(paths).not.toContain('/api/auth/session');
  await context.setOffline(true);
  await page.goto('/dashboard/card');
  await expect(page.getByRole('heading', { name: 'You’re offline' })).toBeVisible();
  expect(await page.evaluate(() => fetch('/api/auth/session').then(() => false, () => true))).toBe(true);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'You’re offline' })).toHaveCount(0);
});
