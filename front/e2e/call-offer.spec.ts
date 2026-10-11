import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { installWallet, signIn } from './wallet';

test('creator service persists and rejects invalid or unauthorized changes', async ({ context, page, playwright }) => {
  const owner = await installWallet(context);
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const wallet = owner.publicKey.toBase58();
  const seed = await db.from('cards_users').insert({ wallet_address: wallet, username: `call_${Date.now()}` });
  expect(seed.error).toBeNull();
  await signIn(page, '/dashboard/bookings');
  await page.getByLabel("Service name").fill("Design mentoring");
  await page.getByLabel("What the service includes").fill('Review your portfolio and provide specific recommendations.');
  await page.getByLabel("Price (test USDC)").fill('12.000001');
  await page.getByLabel("Booking time zone").fill('America/New_York');
  await page.getByRole('button', { name: "Add weekly availability" }).click();
  await page.getByLabel('Accept service bookings').check();
  await page.getByRole('button', { name: "Save service", exact: true }).click();
  await expect(page.getByRole('status')).toHaveText("Service saved to your account.");
  await page.reload();
  await expect(page.getByLabel("Service name")).toHaveValue("Design mentoring");
  await expect(page.getByLabel("Price (test USDC)")).toHaveValue('12.000001');
  await expect(page.getByLabel("Booking time zone")).toHaveValue('America/New_York');
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const offer = (await (await page.request.get('/api/call-offer')).json()).offer;
  expect(offer.creator_wallet).toBeUndefined();
  const invalid = await page.request.put('/api/call-offer', { headers: { Origin: process.env.E2E_BASE_URL! }, data: { ...offer, availability: [...offer.availability, ...offer.availability] } });
  expect(invalid.status()).toBe(400);
  expect((await (await page.request.get('/api/call-offer')).json()).offer).toEqual(offer);
  const crossOrigin = await page.request.put('/api/call-offer', { headers: { Origin: 'https://untrusted.example' }, data: offer });
  expect(crossOrigin.status()).toBe(403);
  const anonymous = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
  expect((await anonymous.get('/api/call-offer')).status()).toBe(401);
  await anonymous.dispose();
});
