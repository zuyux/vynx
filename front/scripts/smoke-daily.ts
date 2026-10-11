import { randomBytes, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { Keypair } from '@solana/web3.js';
import { appDb } from '../lib/app-db';
import { attendance } from '../lib/daily-video';

// Requires a running app and an active webhook. Synthetic booking/session fixtures
// isolate provider verification from payment testing; no escrow funds are moved.
async function main() {
const origin = process.env.DAILY_SMOKE_APP_URL ?? 'http://127.0.0.1:43141';
const target = new URL(origin);
const local = ['localhost','127.0.0.1'].includes(target.hostname);
if (!local && (!process.argv.includes('--deployed') || target.protocol !== 'https:' || origin !== new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost').origin)) throw new Error('Hosted smoke requires --deployed and the configured HTTPS application origin.');
const db = appDb(), creator = Keypair.generate().publicKey.toBase58(), fan = Keypair.generate().publicKey.toBase58();
let offerId: string | undefined, bookingId: string | undefined, roomName: string | undefined;
let evidence: Record<string, unknown> | undefined;
const sessions: string[] = []; let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function checked<T>(operation: PromiseLike<{ data: T; error: unknown }>): Promise<T> { const result = await operation; if (result.error) throw new Error('Smoke database operation failed.'); return result.data; }
try {
  await checked(db.from('cards_users').insert({ wallet_address: creator, username: `daily_smoke_${Date.now()}`, published: false }));
  const offer = await checked(db.from('call_offers').insert({ creator_wallet: creator, title: 'Daily provider smoke test', description: 'Synthetic fixture for provider attendance verification.', duration_minutes: 15, price_units: 10000, timezone: 'UTC', availability: [], accepting: false }).select('id').single()); if(!offer)throw new Error('Offer fixture missing.');offerId = offer.id;
  const start = new Date(Date.now()-60000).toISOString(), end = new Date(Date.now()+840000).toISOString();
  const booking = await checked(db.from('call_bookings').insert({ offer_id:offerId,creator_wallet:creator,payer_wallet:fan,starts_at:start,ends_at:end,expires_at:new Date().toISOString(),terms:{title:'Daily provider smoke test'},price_units:10000,state:'confirmed',payment_signature:`synthetic-provider-smoke-${Date.now()}` }).select('id').single());if(!booking)throw new Error('Booking fixture missing.');bookingId=booking.id;
  console.info('Synthetic booking fixture ready.');
  const accesses: {url:string;token:string}[]=[];
  for (const wallet of [creator,fan]) {
    const cookie=randomBytes(32).toString('hex'),hash=createHash('sha256').update(cookie).digest('hex');sessions.push(hash);
    await checked(db.from('wallet_sessions').insert({wallet,token_hash:hash,expires_at:new Date(Date.now()+1800000).toISOString()}));
    const response=await fetch(`${origin}/api/calls`,{method:'POST',headers:{Origin:process.env.NEXT_PUBLIC_APP_URL ?? origin,Cookie:`vynx-session=${cookie}`,'Content-Type':'application/json'},body:JSON.stringify({id:bookingId})});
    if(!response.ok) throw new Error(`Application token issuance failed (${response.status}).`);
    accesses.push(await response.json());
  }
  const room=await checked(db.from('call_video_rooms').select('*').eq('booking_id',bookingId).single());roomName=room.room_name;
  console.info('Application-issued participant tokens ready.');
  browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
  const pages=[];
  for (const access of accesses) {
    const context=await browser.newContext({permissions:['camera','microphone']});const page=await context.newPage();pages.push(page);
    await page.route(`${origin}/__daily_smoke`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Daily provider test</title>'}));
    await page.goto(`${origin}/__daily_smoke`);
    await page.addScriptTag({path:'node_modules/@daily-co/daily-js/dist/daily-iframe.js'});
    await page.evaluate(async ({url,token})=>{
      const scope=window as unknown as {DailyIframe:{createCallObject:()=>{join:(access:{url:string;token:string})=>Promise<unknown>;leave:()=>Promise<unknown>}};dailySmoke?:{leave:()=>Promise<unknown>}};
      const call=scope.DailyIframe.createCallObject();scope.dailySmoke=call;await call.join({url,token});
    },access);
  }
  console.info('Both authorized participants joined Daily with application-issued tokens.');
  await new Promise(resolve=>setTimeout(resolve,5000));
  for(const page of pages)await page.evaluate(async()=>{await (window as unknown as {dailySmoke:{leave:()=>Promise<unknown>}}).dailySmoke.leave();});
  let result: ReturnType<typeof attendance> | undefined;
  for(let attempt=0;attempt<24;attempt++){
    const events=(await checked(db.from('call_video_events').select('event_id,event_type,event_ts,payload').eq('booking_id',bookingId))) ?? [];
    result=attendance(events,room,start,end);
    if(result.evidence_status==='webhook_evidence'&&result.simultaneous_seconds>0){
      evidence={tested_at:new Date().toISOString(),scope:'live Daily; synthetic booking and server sessions; no escrow payment', app_origin:origin,private_room_verified:true,application_tokens_issued:2,authenticated_events:events.length,event_types:[...new Set(events.map(e=>e.event_type))].sort(),attendance:result,recording_enabled:false,fixtures_cleaned:true};
      console.info(JSON.stringify({events:events.length,simultaneous_seconds:result.simultaneous_seconds,evidence_status:result.evidence_status}));break;
    }
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(result?.evidence_status!=='webhook_evidence'||!result.simultaneous_seconds)throw new Error('Live attendance evidence did not finalize within the test window.');
} finally {
  if(browser)await browser.close();
  if(!roomName&&bookingId){const {data}=await db.from('call_video_rooms').select('room_name').eq('booking_id',bookingId).maybeSingle();roomName=data?.room_name;}
  if(roomName){const response=await fetch(`https://api.daily.co/v1/rooms/${encodeURIComponent(roomName)}`,{method:'DELETE',headers:{Authorization:`Bearer ${process.env.DAILY_API_KEY}`}});if(!response.ok)console.error('Daily smoke room cleanup failed.');}
  if(bookingId){await checked(db.from('call_video_events').delete().eq('booking_id',bookingId));await checked(db.from('call_video_rooms').delete().eq('booking_id',bookingId));await checked(db.from('call_bookings').delete().eq('id',bookingId));}
  if(offerId)await checked(db.from('call_offers').delete().eq('id',offerId));
  await checked(db.from('cards_users').delete().eq('wallet_address',creator));
  for(const hash of sessions)await checked(db.from('wallet_sessions').delete().eq('token_hash',hash));
}
if(evidence)writeFileSync(local ? '../docs/daily-live-smoke.json' : '../docs/daily-vercel-smoke.json',JSON.stringify(evidence,null,2)+'\n');
}
void main().catch(reason=>{ if(reason instanceof Error && /^(Smoke database|Application token|Live attendance|Offer fixture|Booking fixture)/.test(reason.message))console.error(reason.message); console.error("Daily live smoke failed; inspect provider/app state. No secrets logged."); process.exitCode=1; });
