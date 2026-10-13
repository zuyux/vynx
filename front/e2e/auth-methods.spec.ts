import { test, expect } from './test';
import { installWallet, connectWallet } from './wallet';

test('a saved alias cannot bypass choosing, connecting and authenticating a wallet', async ({ browser }) => {
  const context = await browser.newContext();
  const account = await installWallet(context);
  const page = await context.newPage();
  let lookups = 0, confirmations = 0;
  await page.route('**/api/auth/session', async route => {
    if (route.request().method() === 'POST') confirmations++;
    await route.fulfill({ json: { wallet: confirmations ? account.publicKey.toBase58() : null, alias: 'saved_creator' } });
  });
  await page.route('**/api/auth/nonce', route => route.fulfill({ json: { id: 'nonce', message: 'Sign in to Vynx' } }));
  await page.route('**/api/profile?*', route => {
    lookups++;
    return route.fulfill({ json: { profile: { wallet_address: account.publicKey.toBase58(), username: 'saved_creator' } } });
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
    expect(lookups).toBe(0); expect(confirmations).toBe(0);
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phantom', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Brave Wallet', exact: true })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with email', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { walletTestCalls: { connect: number } }).walletTestCalls.connect)).toBe(0);
    await page.getByRole('button', { name: 'Close sign-in', exact: true }).click();
    await expect(page).toHaveURL('/'); expect(confirmations).toBe(0);
    await page.evaluate(() => { (window as unknown as { walletTestReject: boolean }).walletTestReject = true; });
    await connectWallet(page);
    await expect(page.getByRole('alert').filter({ hasText: 'cancelled' })).toBeVisible();
    await expect(page).toHaveURL('/'); expect(lookups).toBe(0); expect(confirmations).toBe(0);
    await connectWallet(page);
    await expect(page).toHaveURL('/dashboard/card');
    expect(confirmations).toBe(1);
    expect(await page.evaluate(() => (window as unknown as { walletTestCalls: { connect: number; message: number } }).walletTestCalls)).toMatchObject({ connect: 2, message: 2 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
    await expect(page).toHaveURL('/');
    expect(confirmations).toBe(1);
  } finally { await context.close(); }
});

test('Brave sign-in uses Brave directly and never falls back to Phantom', async ({ browser }) => {
  const context = await browser.newContext();
  const account = await installWallet(context);
  await context.addInitScript(() => {
    const source = window as unknown as { phantom: { solana: { connect: () => Promise<unknown> } }; braveSolana: unknown; braveConnections: number };
    const original = source.phantom.solana;
    source.braveConnections = 0;
    source.braveSolana = new Proxy(original, { get(target, field) {
      if (field === 'connect') return async () => { source.braveConnections++; return original.connect(); };
      return Reflect.get(target, field);
    } });
  });
  const page = await context.newPage();
  let authenticated = false;
  await page.route('**/api/auth/nonce', route => route.fulfill({ json: { id: 'nonce', message: 'Sign in to Vynx' } }));
  await page.route('**/api/auth/session', route => {
    if (route.request().method() === 'POST') authenticated = true;
    return route.fulfill({ json: { wallet: authenticated ? account.publicKey.toBase58() : null, alias: 'existing_creator' } });
  });
  await page.route('**/api/profile?*', route => route.fulfill({ json: { profile: null } }));
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Brave Wallet', exact: true }).click();
    await expect(page).toHaveURL('/dashboard/card');
    expect(await page.evaluate(() => (window as unknown as { braveConnections: number }).braveConnections)).toBe(1);
    authenticated = false;
    await page.goto('/');
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Phantom', exact: true }).click();
    await expect(page).toHaveURL('/dashboard/card');
    expect(await page.evaluate(() => (window as unknown as { braveConnections: number }).braveConnections)).toBe(0);
  } finally { await context.close(); }
});

for (const method of ['Phantom', 'Brave Wallet'] as const) {
  test(`${method} users without an alias are invited to claim one after sign-in`, async ({ browser }) => {
    const context = await browser.newContext();
    const account = await installWallet(context);
    if (method === 'Brave Wallet') await context.addInitScript(() => {
      const source = window as unknown as { phantom: { solana: unknown }; braveSolana: unknown };
      source.braveSolana = source.phantom.solana;
    });
    const page = await context.newPage();
    let authenticated = false;
    await page.route('**/api/auth/nonce', route => route.fulfill({ json: { id: 'nonce', message: 'Sign in to Vynx' } }));
    await page.route('**/api/auth/session', route => {
      if (route.request().method() === 'POST') authenticated = true;
      return route.fulfill({ json: { wallet: authenticated ? account.publicKey.toBase58() : null, alias: null } });
    });
    await page.route('**/api/profile?*', route => route.fulfill({ json: { profile: null } }));
    try {
      await page.goto('/');
      await expect(page).toHaveURL('/');
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
      await page.getByRole('button', { name: method, exact: true }).click();
      await expect(page).toHaveURL(/\/profile\/buy-alias\?welcome=1/);
      await expect(page.getByRole('heading', { name: 'Claim your alias' })).toBeVisible();
      await expect(page.getByText('Welcome to Vynx.', { exact: false })).toBeVisible();
      await expect(page.getByLabel('Alias', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { walletTestCalls: { connect: number; message: number } }).walletTestCalls)).toMatchObject({ connect: 1, message: 1 });
    } finally { await context.close(); }
  });
}
