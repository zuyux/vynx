import test from 'node:test';
import assert from 'node:assert/strict';
import { POST, GET } from '../app/api/demo/bookings/route.ts';
test('demo reservation is opt-in, authenticated and snapshots accepted timezone', async () => {
 const keys=['VYNX_DEMO_BOOKINGS_ENABLED','SUPABASE_URL','SUPABASE_SECRET_KEY','NEXT_PUBLIC_APP_URL'];
 const saved=keys.map(key=>process.env[key]), original=globalThis.fetch;
 const origin='https://demo.example', id='12345678-1234-1234-1234-123456789abc';
 Object.assign(process.env,{VYNX_DEMO_BOOKINGS_ENABLED:'true',SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_APP_URL:origin});
 let calls=0;
 globalThis.fetch=async(input,init)=>{
  const request=new Request(input,init),name=new URL(request.url).pathname.split('/').at(-1);
  const reply=data=>Response.json(data);
  if(name==='consume_public_endpoint_limit')return reply({allowed:true,retry_after:60});
  if(name==='wallet_sessions')return reply([{wallet:'signed-in-fan'}]);
  if(name==='reserve_demo_call'){
   calls++;const args=await request.json();assert.equal(args.payer,'signed-in-fan');assert.equal(args.viewer_timezone,'America/Lima');
   assert.equal(args.accepted_policy,'vynx-demo-booking-v1');assert.equal(args.request_id,id);
   return reply({id,starts_at:args.slot,ends_at:'2026-10-12T18:30:00.000Z',terms:{viewer_timezone:args.viewer_timezone},accepted_at:'2026-10-11T00:00:00Z',payer_wallet:args.payer});
  }
  throw Error(name);
 };
 const request=(body,headers={})=>new Request(`${origin}/api/demo/bookings`,{method:'POST',headers:{origin,cookie:`vynx-session=${'a'.repeat(64)}`,...headers},body:JSON.stringify(body)});
 const body={request_id:id,slot:'2026-10-12T18:00:00.000Z',accepted_policy:'vynx-demo-booking-v1',timezone:'America/Lima'};
 try{
  process.env.VYNX_DEMO_BOOKINGS_ENABLED='false';assert.equal((await GET(new Request(origin))).status,404);process.env.VYNX_DEMO_BOOKINGS_ENABLED='true';
  assert.equal((await POST(request(body,{origin:'https://attacker.example'}))).status,403);
  assert.equal((await POST(request(body,{cookie:''}))).status,401);
  assert.equal((await POST(request({...body,accepted_policy:undefined}))).status,400);
  assert.equal((await POST(request({...body,timezone:'invalid'}))).status,400);
  assert.equal((await POST(request({...body,slot:'2026-02-30T18:00:00.000Z'}))).status,400);
  assert.equal((await POST(request({padding:'a'.repeat(3000)}))).status,413);
  const first=await(await POST(request(body))).json(),again=await(await POST(request(body))).json();
  assert.deepEqual(first,again);assert.equal(first.booking.payer_wallet,undefined);assert.equal(calls,2);
 }finally{globalThis.fetch=original;keys.forEach((key,i)=>saved[i]===undefined?delete process.env[key]:process.env[key]=saved[i]);}
});
