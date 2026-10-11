import { test, expect } from './test';

// Engine-independent public surfaces: exercise narrow phones, tablets and desktop.
test('public pages and disclosures fit mobile viewports and remain navigable', async ({ page, browser }, testInfo) => {
  console.log(`${testInfo.project.name}: ${browser.version()}`);
  expect(browser.browserType().name()).toBe(testInfo.project.use.browserName || 'chromium');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/', '/profile/buy-alias', '/help/terms', '/help/privacy', '/help/fees', '/help/network', '/support']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('main')).toBeVisible();
    for (const width of [320, 375, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `${path} overflows at ${width}px` }).toBe(true);
      const links = page.getByRole('navigation', { name: 'Legal and support' }).getByRole('link');
      await expect(links).toHaveCount(5);
      for (const link of await links.all()) {
        const box = await link.boundingBox();
        expect(box, `${path}: footer link has a layout box`).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      }
    }
  }
  await page.getByRole('navigation', { name: 'Legal and support' }).getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page).toHaveURL(/\/help\/privacy$/);
  await expect(page.getByRole('heading', { name: 'Privacy Notice', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('creator dashboards and public offers fit narrow screens', async ({ page, context }) => {
  const { createClient } = await import('@supabase/supabase-js');
  const { installWallet, signIn } = await import('./wallet');
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const wallet = await installWallet(context);
  const alias = `layout_${Date.now()}`;
  const design = { version: 1, alias, name: 'Mobile creator', bio: 'A creator story that wraps across narrow screens.', avatar: '', cover: '', accent: 'mint', theme: 'dark', rounded: true, links: [{ id: 'project', title: 'My latest creative project and community', url: 'https://example.com/project' }], socials: { instagram: '', youtube: '', x: '' } };
  const inserted = await db.from('cards_users').insert({ username: alias, wallet_address: wallet.publicKey.toBase58(), display_name: design.name, design, published: true });
  expect(inserted.error).toBeNull();
  const offer = await db.from('sponsor_profiles').insert({ wallet: wallet.publicKey.toBase58(), alias, display_name: design.name, bio: design.bio, design, price_cents: 1500, duration_days: 7, accepting: true });
  expect(offer.error).toBeNull();
  try {
    await signIn(page, '/dashboard/card');
    await expect(page.getByLabel('Nombre de creador')).toBeEnabled();
    for (const path of ['/dashboard', '/dashboard/card', '/dashboard/card/preview', '/dashboard/products', '/dashboard/studio', '/dashboard/sponsorships', `/${alias}`, `/creators/${alias}`]) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.getByRole('main')).toBeVisible();
      for (const width of [320, 375, 430, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `${path} overflows at ${width}px` }).toBe(true);
      }
    }
  } finally {
    await db.from('sponsor_profiles').delete().eq('wallet', wallet.publicKey.toBase58());
    await db.from('cards_users').delete().eq('wallet_address', wallet.publicKey.toBase58());
  }
});
