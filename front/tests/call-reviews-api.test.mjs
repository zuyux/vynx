import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/api/call-reviews/route.ts';
import { GET as history } from '../app/api/creator-history/route.ts';
test('review API binds the actor to the signed session and rejects unauthenticated, cross-origin and forged requests',async()=>{
 const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','NEXT_PUBLIC_APP_URL','VYNX_ALIAS_REGISTRY_ENABLED'],saved=keys.map(k=>process.env[k]),oldFetch=globalThis.fetch;
 const origin='https://vynx.test',id='12345678-1234-1234-1234-123456789abc';
 Object.assign(process.env,{SUPABASE_URL:'https://reviews.supabase.co',SUPABASE_SECRET_KEY:'private-key',NEXT_PUBLIC_APP_URL:origin,VYNX_ALIAS_REGISTRY_ENABLED:'false'});
 let wallet='fan',rpcCalls=0,rpcError=null,stored=null;
 globalThis.fetch=async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url),name=url.pathname.split('/').at(-1);
  if(name==='consume_public_endpoint_limit')return Response.json({allowed:true,retry_after:60});
  if(name==='wallet_sessions')return Response.json([{wallet}]);
  if(name==='call_bookings')return Response.json([{payer_wallet:'fan',state:'completed',payment_signature:'private-signature',ends_at:new Date(Date.now()-3600000).toISOString()}]);
  if(name==='call_reviews')return Response.json(stored?[stored]:[]);
  if(name==='submit_call_review'){
   rpcCalls++;const args=await req.json();assert.equal(args.actor,wallet);
   if(rpcError)return new Response(JSON.stringify({code:rpcError,message:'private database detail'}),{status:400});
   stored={booking_id:id,overall_rating:args.overall,punctuality:args.punctuality_score,communication:args.communication_score,fulfillment:args.fulfillment_score,comment:args.review_comment,created_at:new Date().toISOString()};return Response.json(stored);
  }
  if(name==='cards_users'){
   assert.equal(url.searchParams.get('published'),'eq.true');
   return Response.json(url.searchParams.get('username')==='eq.hidden'?[]:[{id:'creator',username:'visible',wallet_address:'creator-wallet',published:true,tips_enabled:false}]);
  }
  if(name==='creator_call_evidence')return Response.json([]);
  if(name==='creator_review_summary')return Response.json({review_count:0,average_rating:null,comments:[],has_more:false});
  throw Error(`Unexpected request ${req.url}`);
 };
 const payload={id,overall_rating:1,punctuality:2,communication:3,fulfillment:1,comment:' Unhappy with service '};
 const request=(body=payload,cookie=true,requestOrigin=origin)=>new Request(`${origin}/api/call-reviews`,{method:'POST',headers:{origin:requestOrigin,...(cookie?{cookie:`vynx-session=${'a'.repeat(64)}`}:{})},body:JSON.stringify(body)});
 const read=()=>GET(new Request(`${origin}/api/call-reviews?id=${id}`,{headers:{cookie:`vynx-session=${'a'.repeat(64)}`}}));
 try {
  assert.equal((await POST(request(payload,false))).status,401);
  assert.equal((await POST(request(payload,true,'https://evil.test'))).status,403);
  assert.equal((await POST(request({...payload,actor:'other-fan'}))).status,400);
  assert.equal((await POST(request({...payload,punctuality:6}))).status,400);assert.equal(rpcCalls,0);
  assert.equal((await (await read()).json()).eligible,true);
  wallet='creator';assert.equal((await read()).status,404);rpcError='P0002';assert.equal((await POST(request())).status,404);
  wallet='fan';rpcError='P0001';assert.equal((await POST(request())).status,409);
  rpcError=null;const response=await POST(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert.equal(result.review.overall_rating,1);assert.equal(result.review.comment,'Unhappy with service');assert.equal('booking_id' in result.review,false);
  assert.equal((await (await read()).json()).eligible,false);
  rpcError='23505';assert.equal((await POST(request())).status,409);
  rpcError='XX000';assert.equal((await POST(request())).status,503);
  const hidden=await history(new Request(`${origin}/api/creator-history?alias=hidden`));assert.equal(hidden.status,404);
  const empty=await history(new Request(`${origin}/api/creator-history?alias=visible`));assert.equal(empty.status,200);
  assert.deepEqual(await empty.json(),{review_count:0,average_rating:null,comments:[],has_more:false,verified_completed_calls:0});
  assert.equal((await history(new Request(`${origin}/api/creator-history?alias=visible&offset=-1`))).status,400);
 }finally{globalThis.fetch=oldFetch;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
