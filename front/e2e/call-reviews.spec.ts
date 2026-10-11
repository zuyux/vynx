import { test, expect } from './test';
import { installWallet } from './wallet';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@solana/web3.js';

test('paying fan reviews once; public card shows independent verified counts, feedback and an empty state', async ({ context, page }) => {
  const fan = await installWallet(context), creator = Keypair.generate(), alias = `reviews_${Date.now()}`;
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  expect((await db.from('cards_users').insert([
    { wallet_address: fan.publicKey.toBase58(), username: `review_fan_${Date.now()}`, published: false },
    { wallet_address: creator.publicKey.toBase58(), username: alias, display_name: 'Reviewed creator', published: true },
  ])).error).toBeNull();
  const offer = await db.from('call_offers').insert({ creator_wallet: creator.publicKey.toBase58(), title: 'Completed mentoring', description: 'Portfolio mentoring.', duration_minutes: 30, price_units: 1000000, timezone: 'UTC', availability: [], accepting: false }).select('id').single();
  expect(offer.error).toBeNull();
  const from = Math.floor(Date.now() / 1000) - 86400;
  const booking = await db.from('call_bookings').insert({ offer_id: offer.data!.id, creator_wallet: creator.publicKey.toBase58(), payer_wallet: fan.publicKey.toBase58(), starts_at: new Date(from*1000).toISOString(), ends_at: new Date((from+1800)*1000).toISOString(), expires_at: new Date().toISOString(), terms: { title: 'Completed mentoring' }, price_units: 1000000, state: 'completed', payment_signature: `review-test-${Date.now()}` }).select('id').single();
  expect(booking.error).toBeNull();
  const room = await db.from('call_video_rooms').insert({ booking_id: booking.data!.id }).select('*').single();
  expect(room.error).toBeNull();
  const event = (event_type: string, payload: Record<string,unknown>) => ({ event_id: crypto.randomUUID(), booking_id: booking.data!.id, event_type, event_ts: from, payload: { room: room.data!.room_name, ...payload } });
  const events = [event('meeting.ended', { meeting_id: 'm', start_ts: from, end_ts: from+1800 })];
  for (const user_id of [room.data!.creator_user_id,room.data!.fan_user_id]) events.push(event('participant.joined',{user_id,session_id:user_id,joined_at:from}),event('participant.left',{user_id,session_id:user_id,joined_at:from,duration:1620}));
  expect((await db.from('call_video_events').insert(events)).error).toBeNull();
  await page.goto(`/calls/${booking.data!.id}`);
  await page.getByRole('button', { name: 'Connect wallet and sign in' }).click();
  await page.getByRole('button', { name: 'Phantom', exact: true }).click();
  await expect(page.getByText('Attendance completion verified.', { exact: false })).toBeVisible();
  for (const label of ['Overall rating','Punctuality','Communication','Fulfillment of the offered service']) await page.getByLabel(label,{exact:true}).selectOption('1');
  await page.getByLabel('Comment',{exact:true}).fill('Unsatisfied with the advice. <script>alert("x")</script>');
  await page.getByRole('button',{name:'Submit review',exact:true}).click();
  await expect(page.getByText('Review submitted · 1/5 overall')).toBeVisible();
  const duplicate = await page.request.post('/api/call-reviews',{headers:{origin:process.env.E2E_BASE_URL!},data:{id:booking.data!.id,overall_rating:5,punctuality:5,communication:5,fulfillment:5,comment:'Changed opinion'}});
  expect(duplicate.status()).toBe(409);
  expect((await db.from('call_reviews').select('*').eq('booking_id',booking.data!.id)).data).toHaveLength(1);
  await page.goto(`/${alias}`);
  const history=page.getByRole('region',{name:'Call history & reviews'});
  await expect(history.getByText('1.0/5',{exact:true})).toBeVisible();
  await expect(history.getByText('Unsatisfied with the advice. <script>alert("x")</script>',{exact:true})).toBeVisible();
  const response=await page.request.get(`/api/creator-history?alias=${alias}`),data=await response.json();
  expect(data.verified_completed_calls).toBe(1);expect(data.review_count).toBe(1);
  expect(JSON.stringify(data)).not.toContain(fan.publicKey.toBase58());expect(JSON.stringify(data)).not.toContain(booking.data!.id);
  for (const width of [320,375,430]) { await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true); }
  const emptyAlias=`empty_reviews_${Date.now()}`;
  expect((await db.from('cards_users').insert({wallet_address:Keypair.generate().publicKey.toBase58(),username:emptyAlias,published:true})).error).toBeNull();
  const emptyHistory = page.waitForResponse(response => response.url().includes(`/api/creator-history?alias=${emptyAlias}`));
  await page.goto(`/${emptyAlias}`);
  expect((await (await emptyHistory).json()).review_count).toBe(0);
  await expect(page.getByRole('region',{name:'Call history & reviews'})).toHaveCount(0);
});
