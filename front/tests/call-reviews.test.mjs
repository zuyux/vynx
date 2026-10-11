import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewInput } from '../lib/call-review.ts';
import { hasVerifiedAttendance, creatorCallHistory } from '../lib/creator-call-history.ts';
const valid={overall_rating:1,punctuality:2,communication:3,fulfillment:4,comment:' Honest feedback '};
test('reviews validate all ratings and bounded comments without conflating satisfaction with attendance', () => {
 assert.equal(reviewInput(valid).comment,'Honest feedback');
 for(const field of ['overall_rating','punctuality','communication','fulfillment'])for(const bad of [null,0,6,1.5,'5'])assert.equal(reviewInput({...valid,[field]:bad}),null);
 for(const comment of ['', '   ', null, 'x'.repeat(2001)])assert.equal(reviewInput({...valid,comment}),null);
 assert.ok(reviewInput({...valid,comment:'😀'.repeat(2000)}));
});
test('public verified counts exclude missing and truncated evidence and below-threshold calls', () => {
 const from=Math.floor(Date.now()/1000)-3600, room={creator_user_id:'c',fan_user_id:'f',room_name:'private'};
 const event=(event_type,payload)=>({event_id:JSON.stringify(payload),event_type,event_ts:from,payload});
 const events=[event('meeting.ended',{meeting_id:'m',start_ts:from,end_ts:from+600})];
 for(const user_id of ['c','f'])events.push(event('participant.joined',{user_id,session_id:user_id,joined_at:from}),event('participant.left',{user_id,session_id:user_id,joined_at:from,duration:540}));
 const row={id:'booking',room,events,starts_at:new Date(from*1000).toISOString(),ends_at:new Date((from+600)*1000).toISOString()};
 assert.equal(hasVerifiedAttendance(row),true);
 assert.equal(hasVerifiedAttendance({...row,room:null}),false);
 assert.equal(hasVerifiedAttendance({...row,events:[]}),false);
 assert.equal(hasVerifiedAttendance({...row,events:Array.from({length:1000},(_,i)=>events[i%events.length])}),false);
 events.at(-1).payload.duration=539;assert.equal(hasVerifiedAttendance(row),false);
});
test('history counts all keyset pages and surfaces storage failures rather than false empty history',async()=>{
 const previous=globalThis.fetch,keys=['SUPABASE_URL','SUPABASE_SECRET_KEY'],saved=keys.map(k=>process.env[k]);
 Object.assign(process.env,{SUPABASE_URL:'https://history.supabase.co',SUPABASE_SECRET_KEY:'secret'});
 let requests=0,fail=false;
 globalThis.fetch=async(input,init)=>{
  const req=new Request(input,init),name=new URL(req.url).pathname.split('/').at(-1),body=await req.json();
  if(fail)return new Response(JSON.stringify({message:'offline'}),{status:500});
  if(name==='creator_review_summary'){assert.equal(body.page_offset,20);return Response.json({review_count:22,average_rating:4.82,comments:[],has_more:false});}
  assert.equal(name,'creator_call_evidence');requests++;
  if(body.after_id===null)return Response.json(Array.from({length:50},(_,i)=>({id:String(i),room:null,events:[]})));
  assert.equal(body.after_id,'49');return Response.json([]);
 };
 try {const result=await creatorCallHistory('creator',20);assert.equal(result.verified_completed_calls,0);assert.equal(result.review_count,22);assert.equal(requests,2);
  fail=true;await assert.rejects(creatorCallHistory('creator',20));
 }finally{globalThis.fetch=previous;keys.forEach((k,i)=>saved[i]===undefined?delete process.env[k]:process.env[k]=saved[i]);}
});
