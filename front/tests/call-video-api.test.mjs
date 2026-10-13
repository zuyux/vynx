import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { GET, POST } from '../app/api/calls/route.ts';
import { POST as webhook } from '../app/api/daily/webhook/route.ts';
const json = data => Response.json(data);
test('call API enforces participants, funded booking and time; retries recover one private room; webhook persists before acknowledgement', async () => {
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','NEXT_PUBLIC_APP_URL','DAILY_API_KEY','DAILY_WEBHOOK_HMAC_BASE64'];const saved=keys.map(k=>process.env[k]),oldFetch=globalThis.fetch;
 const origin='https://vynx.test',id='12345678-1234-1234-1234-123456789abc';
 Object.assign(process.env,{SUPABASE_URL:'https://video.supabase.co',SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_APP_URL:origin,DAILY_API_KEY:'PRIVATE-KEY',DAILY_WEBHOOK_HMAC_BASE64:Buffer.alloc(32,37).toString('base64')});
 let wallet='fan',allocated=false,provider=null,tokenCalls=0,writeFail=false;
 let booking={id,creator_wallet:'creator',payer_wallet:'fan',starts_at:new Date(Date.now()-300000).toISOString(),ends_at:new Date(Date.now()+1500000).toISOString(),state:'confirmed',payment_signature:'verified',terms:{title:'Call'}};
 const room={booking_id:id,room_name:'vynx-private',creator_user_id:'creator-id',fan_user_id:'fan-id'};const events=new Map();
 globalThis.fetch=async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url),name=url.pathname.split('/').at(-1);
  if(url.hostname==='api.daily.co'){
   assert.equal(req.headers.get('authorization'),'Bearer PRIVATE-KEY');
   if(name==='rooms'){const b=await req.json();assert.equal(b.privacy,'private');if(provider)return new Response('{}',{status:409});provider={name:b.name,privacy:b.privacy,url:`https://vynx.daily.co/${b.name}`,config:b.properties};return json(provider);}
   if(name==='vynx-private')return json(provider);
   if(name==='meeting-tokens'){const b=await req.json();assert.equal(b.properties.user_id,wallet==='creator'?'creator-id':'fan-id');assert.equal(b.properties.is_owner,false);assert.equal(b.properties.permissions.canAdmin,false);tokenCalls++;return json({token:'PRIVATE-TOKEN'});}
  }
  assert.equal(url.hostname,'video.supabase.co');
  if(name==='consume_public_endpoint_limit')return json({allowed:true,retry_after:60});
  if(name==='wallet_sessions')return json([{wallet}]);
  if(name==='call_bookings')return json([booking]);
  if(name==='call_video_rooms'){
   if(req.method==='POST'){allocated=true;return new Response(null,{status:201});}
   if(url.searchParams.has('room_name'))return json([{booking_id:id}]);
   return json(req.headers.get('accept')?.includes('vnd.pgrst.object') ? room : allocated?[room]:[]);
  }
  if(name==='record_call_video_event'){
   const event=await req.json();if(writeFail)return jsonError('XX000',500);
   if(events.has(event.event_id)&&JSON.stringify(events.get(event.event_id))!==JSON.stringify(event))return jsonError('23505',409);
   events.set(event.event_id,event);return new Response(null,{status:204});
  }
  if(name==='call_video_events'){
   if(req.method==='POST'){const event=await req.json();if(writeFail)return jsonError('XX000',500);if(events.has(event.event_id))return jsonError('23505',409);events.set(event.event_id,event);return new Response(null,{status:201});}
   const eid=url.searchParams.get('event_id')?.slice(3);return json(eid ? events.get(eid) : [...events.values()]);
  }
  throw Error(`Unexpected request ${req.url}`);
 };
 const jsonError=(code,status)=>new Response(JSON.stringify({code,message:'failure'}),{status,headers:{'content-type':'application/json'}});
 const request=(body,cookie=true,requestOrigin=origin)=>new Request(`${origin}/api/calls`,{method:'POST',headers:{origin:requestOrigin,...(cookie?{cookie:`vynx-session=${'a'.repeat(64)}`}:{})},body:JSON.stringify(body)});
 const delivery=(body,signature=true)=>{const ts=String(Math.floor(Date.now()/1000));const sig=createHmac('sha256',Buffer.from(process.env.DAILY_WEBHOOK_HMAC_BASE64,'base64')).update(`${ts}.${JSON.stringify(body)}`).digest('base64');return new Request(`${origin}/api/daily/webhook`,{method:'POST',headers:{'x-webhook-timestamp':ts,'x-webhook-signature':signature?sig:'bad'},body:JSON.stringify(body)});};
 try {
  assert.equal((await POST(request({id},false))).status,401);assert.equal((await POST(request({id},true,'https://evil.test'))).status,403);
  wallet='outsider';assert.equal((await POST(request({id}))).status,404);assert.equal(tokenCalls,0);
  wallet='fan';booking.state='awaiting_payment';assert.equal((await POST(request({id}))).status,409);booking.state='confirmed';
  booking.price_units=25000000;booking.expires_at=new Date(Date.now()+600000).toISOString();
  const listRequest=()=>new Request(`${origin}/api/calls?view=current`,{headers:{cookie:`vynx-session=${'a'.repeat(64)}`}});
  booking.state='awaiting_payment';booking.payment_signature=null;
  let listed=await (await GET(listRequest())).json();assert.equal(listed.calls.length,1);assert.equal(listed.calls[0].payment_status,'awaiting_payment');assert.equal(listed.calls[0].participant_wallet,'creator');assert.equal(listed.calls[0].price_units,25000000);
  booking.expires_at=new Date(Date.now()-1000).toISOString();listed=await (await GET(listRequest())).json();assert.equal(listed.calls.length,0);
  booking.state='confirmed';booking.payment_signature='verified';wallet='creator';
  listed=await (await GET(listRequest())).json();assert.equal(listed.calls[0].payment_status,'paid');assert.equal(listed.calls[0].participant_wallet,'fan');wallet='fan';
  const originalStart=booking.starts_at;booking.starts_at=new Date(Date.now()+3600000).toISOString();assert.equal((await POST(request({id}))).status,409);booking.starts_at=originalStart;
  const first=await POST(request({id}));assert.equal(first.status,200);assert.equal(first.headers.get('cache-control'),'no-store');assert.equal((await first.json()).token,'PRIVATE-TOKEN');
  wallet='creator';assert.equal((await POST(request({id}))).status,200);assert.equal(tokenCalls,2);assert.ok(allocated);
  const evt={version:'1.0.0',type:'participant.joined',id:'delivery',event_ts:Date.now()/1000,payload:{room:room.room_name,user_id:'fan-id',session_id:'session',joined_at:Date.now()/1000}};
  assert.equal((await webhook(delivery(evt,false))).status,401);assert.equal(events.size,0);
  writeFail=true;assert.equal((await webhook(delivery(evt))).status,503);assert.equal(events.size,0);writeFail=false;
  assert.equal((await webhook(delivery({test:'test'}))).status,200);
  assert.equal((await webhook(delivery(evt))).status,200);assert.equal((await webhook(delivery(evt))).status,200);assert.equal(events.size,1);
  assert.equal((await webhook(delivery({...evt,payload:{...evt.payload,user_id:'creator-id'}}))).status,409);
  const response=await GET(new Request(`${origin}/api/calls?id=${id}`,{headers:{cookie:`vynx-session=${'a'.repeat(64)}`}}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.attendance.evidence_status,'incomplete');assert.doesNotMatch(JSON.stringify(result),/PRIVATE-TOKEN|PRIVATE-KEY|creator-id|fan-id/);
  assert.equal(result.completion.status,'pending');
  booking.starts_at=new Date(Date.now()-1200000).toISOString();booking.ends_at=new Date(Date.now()-600000).toISOString();booking.state='completed';
  const readCompletion=async()=> (await (await GET(new Request(`${origin}/api/calls?id=${id}`,{headers:{cookie:`vynx-session=${'a'.repeat(64)}`}}))).json()).completion;
  // Payer acknowledgement alone cannot verify attendance.
  assert.equal((await readCompletion()).status,'review_required');
  events.clear();const from=Date.parse(booking.starts_at)/1000;
  const deliveries=[{type:'meeting.ended',payload:{meeting_id:'m',start_ts:from,end_ts:from+600}}];
  for(const user of ['creator-id','fan-id'])deliveries.push({type:'participant.joined',payload:{user_id:user,session_id:user,joined_at:from}},{type:'participant.left',payload:{user_id:user,session_id:user,joined_at:from,duration:540}});
  for(const [i,e] of deliveries.entries())assert.equal((await webhook(delivery({...evt,id:`completion-${i}`,type:e.type,payload:{room:room.room_name,...e.payload}}))).status,200);
  assert.equal((await readCompletion()).status,'verified');
  // Hitting the fetch limit must invalidate verification before evaluating it.
  for(let i=events.size;i<1000;i++)events.set(`extra-${i}`,{event_id:`extra-${i}`,event_type:'meeting.ended',event_ts:from+600,payload:{room:room.room_name,meeting_id:'m',start_ts:from,end_ts:from+600}});
  assert.equal((await readCompletion()).status,'review_required');
  booking.state='confirmed';booking.starts_at=originalStart;
  const originalEnd=booking.ends_at;booking.ends_at=new Date(Date.now()-3600000).toISOString();assert.equal((await POST(request({id}))).status,410);booking.ends_at=originalEnd;
 } finally {globalThis.fetch=oldFetch;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
