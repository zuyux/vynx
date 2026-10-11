import { test, expect } from './test';
import { installWallet } from './wallet';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';

test('private call screen uses authenticated booking API, denies a stranger and fits mobile', async ({ context, page }) => {
  const fan = await installWallet(context), creator = Keypair.generate();
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  const profile = await db.from('cards_users').insert({wallet_address:creator.publicKey.toBase58(),username:`video_${Date.now()}`,published:false});
  expect(profile.error).toBeNull();
  const offer = await db.from('call_offers').insert({ creator_wallet: creator.publicKey.toBase58(), title: 'Private mentorship', description: 'Review a portfolio together.', duration_minutes: 30, price_units: 1000000, currency: 'USDC', cluster: 'devnet', timezone: 'UTC', availability: [], accepting: false }).select('id').single();
  expect(offer.error).toBeNull();
  const booking = await db.from('call_bookings').insert({ offer_id: offer.data!.id, creator_wallet: creator.publicKey.toBase58(), payer_wallet: fan.publicKey.toBase58(), starts_at: new Date(Date.now()-300000).toISOString(), ends_at: new Date(Date.now()+1500000).toISOString(), expires_at: new Date().toISOString(), terms: { title: 'Private mentorship' }, price_units:1000000, state:'confirmed', payment_signature:`video-test-${Date.now()}` }).select('id').single();
  expect(booking.error).toBeNull();
  // Real wallet challenge/session, API authorization, database and page. Daily
  // network calls are covered by API mocks until account credentials are available.
  await page.goto(`/calls/${booking.data!.id}`);
  await page.getByRole('button', { name:"Connect wallet and sign in" }).click();
  await expect(page.getByRole('heading', { name:'Private mentorship' })).toBeVisible();
  await expect(page.getByText('This call is not recorded.', {exact:false})).toBeVisible();
  const protectedResponse = await page.request.get(`/api/calls?id=${booking.data!.id}`);
  expect(protectedResponse.status()).toBe(200);
  expect((await protectedResponse.json()).call.role).toBe('fan');
  for (const width of [320,375,430]) {
    await page.setViewportSize({width,height:800});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect(page.getByRole('button',{name:"Join call"})).toBeVisible();
  }
  // An unrelated booking ID leaks neither participant identities nor the title.
  const other = await db.from('call_bookings').insert({ offer_id: offer.data!.id, creator_wallet: creator.publicKey.toBase58(), payer_wallet: Keypair.generate().publicKey.toBase58(), starts_at:new Date(Date.now()+86400000).toISOString(),ends_at:new Date(Date.now()+88200000).toISOString(),expires_at:new Date().toISOString(),terms:{title:'Hidden title'},price_units:1000000,state:'confirmed',payment_signature:`stranger-test-${Date.now()}` }).select('id').single();
  expect(other.error).toBeNull();
  const denied = await page.request.get(`/api/calls?id=${other.data!.id}`);
  expect(denied.status()).toBe(404);expect(await denied.text()).not.toContain('Hidden title');
});
