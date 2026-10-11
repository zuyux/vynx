import { test, expect } from './test';
import { createClient } from '@supabase/supabase-js';
import { Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { installWallet } from './wallet';

test('booking UI preserves uncertain sends, recovers by signature and fits mobile', async ({ context, page }) => {
  // Booking responses are mocked: production checkout remains disabled. Actual
  // custody and API verification are exercised by SBF/API tests separately.
  const fan = await installWallet(context), creator = Keypair.generate();
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const alias = `booking_${Date.now()}`;
  const seed = await db.from('cards_users').insert({ wallet_address: creator.publicKey.toBase58(), username: alias, published: true, display_name: 'Booking test creator' });
  expect(seed.error).toBeNull();
  const starts = new Date(Date.now() + 86400000).toISOString();
  const booking = { id: '12345678-1234-1234-1234-123456789abc', starts_at: starts, state: 'awaiting_payment', signature: null as string | null, terms: { title: 'Mentoría', timezone: 'America/Lima' }, price_units: 1000000 };
  let reservations = 0, checkouts = 0, confirmations = 0;
  const tx = new Transaction({ feePayer: fan.publicKey, recentBlockhash: fan.publicKey.toBase58() }).add(SystemProgram.transfer({ fromPubkey: fan.publicKey, toPubkey: creator.publicKey, lamports: 1 }));
  await page.route('**/api/bookings**', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      if (new URL(request.url()).searchParams.has('id')) return route.fulfill({ json: { booking } });
      return route.fulfill({ json: { offer: { title: 'Mentoría', duration_minutes: 30, price: '1', timezone: 'America/Lima' }, slots: [starts] } });
    }
    const body = request.postDataJSON();
    if (body.action === 'reserve') { reservations++; return route.fulfill({ json: { booking } }); }
    if (body.action === 'checkout') { checkouts++; return route.fulfill({ json: { booking, transaction: tx.serialize({ requireAllSignatures: false }).toString('base64') } }); }
    if (body.action === 'confirm') { confirmations++; booking.state = 'confirmed'; booking.signature = body.signature; return route.fulfill({ json: { booking } }); }
    throw Error('Unexpected booking action');
  });
  await page.goto(`/${alias}`);
  await expect(page.getByRole('heading', { name: "Book a call" })).toBeVisible();
  await page.getByRole('button', { name: "Connect wallet to book" }).click();
  await expect(page.getByRole('button', { name: 'Book and pay into escrow' })).toBeVisible();
  await page.getByLabel('Time slot (America/Lima)').selectOption(starts);
  await page.getByRole('checkbox').check();
  await page.evaluate(() => { (window as typeof window & { walletTestTransactionError: unknown }).walletTestTransactionError = { message: 'Wallet response lost' }; });
  await page.getByRole('button', { name: 'Book and pay into escrow' }).click();
  await expect(page.getByRole('button', { name: 'Continue / verify booking' })).toBeEnabled();
  expect(reservations).toBe(1); expect(checkouts).toBe(1);
  await page.getByRole('button', { name: 'Continue / verify booking' }).click();
  await expect(page.getByRole('status')).toContainText('submission result is uncertain');
  expect(checkouts).toBe(1);
  await page.reload();
  const connect = page.getByRole('button', { name: "Connect wallet to book" });
  if (await connect.isVisible()) await connect.click();
  await expect(page.getByRole('button', { name: 'Continue / verify booking' })).toBeVisible();
  await page.getByLabel("Signature to recover a submitted payment (optional)").fill('1'.repeat(88));
  await page.getByRole('button', { name: 'Continue / verify booking' }).click();
  await expect(page.getByRole('status')).toContainText('Booking confirmed');
  expect(confirmations).toBe(1); expect(reservations).toBe(1); expect(checkouts).toBe(1);
  for (const width of [320, 375, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
