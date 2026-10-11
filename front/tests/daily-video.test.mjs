import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { attendance, assertPrivateRoom, callWindow, roomProperties, tokenProperties, verifyDailyWebhook, normalizedEvent, boundedJSON } from '../lib/daily-video.ts';
const room = { room_name: 'vynx-private', creator_user_id: 'creator', fan_user_id: 'fan' };
const start = new Date(1000000).toISOString(), end = new Date(1600000).toISOString();
const event = (type, payload) => ({ event_id: `${type}:${JSON.stringify(payload)}`, event_type: type, event_ts: 1700, payload: { room: room.room_name, ...payload } });
const session = (user, id, join, duration) => [event('participant.joined', {user_id:user,session_id:id,joined_at:join}), event('participant.left', {user_id:user,session_id:id,joined_at:join,duration})];
const meeting = event('meeting.ended', {meeting_id:'meeting',start_ts:900,end_ts:1700});
test('private room and participant tokens bind access to the booking and time window', () => {
 const config = roomProperties(start,end); assert.equal(config.max_participants,2); assert.equal(config.enable_knocking,false);
 const provider={name:room.room_name,privacy:'private',url:`https://vynx.daily.co/${room.room_name}`,config};
 assert.equal(assertPrivateRoom(provider,room.room_name,start,end),provider.url);
 for(const bad of [{privacy:'public'},{url:'https://attacker.test/vynx-private'},{config:{...config,max_participants:3}},{config:{...config,enable_recording:'cloud'}}])assert.throws(()=>assertPrivateRoom({...provider,...bad},room.room_name,start,end));
 for(const role of ['creator','fan']){const p=tokenProperties(room,role,start,end);assert.equal(p.user_id,role);assert.equal(p.room_name,room.room_name);assert.equal(p.is_owner,false);assert.equal(p.permissions.canAdmin,false);assert.equal(p.start_cloud_recording,false);assert.deepEqual({nbf:p.nbf,exp:p.exp},callWindow(start,end));}
});
test('Daily HMAC rejects forged, changed and expired deliveries, accepting signed verification probes', () => {
 const saved=process.env.DAILY_WEBHOOK_HMAC_BASE64;process.env.DAILY_WEBHOOK_HMAC_BASE64=Buffer.alloc(32,42).toString('base64');
 try {const body={test:'test'};const now=1700000000000;
 for(const ts of ['1700000000','1700000000000']){const sig=createHmac('sha256',Buffer.from(process.env.DAILY_WEBHOOK_HMAC_BASE64,'base64')).update(`${ts}.${JSON.stringify(body)}`).digest('base64');const headers=new Headers({'x-webhook-timestamp':ts,'x-webhook-signature':sig});assert.doesNotThrow(()=>verifyDailyWebhook(headers,body,now));assert.throws(()=>verifyDailyWebhook(headers,{test:'changed'},now));assert.throws(()=>verifyDailyWebhook(headers,body,now+301000));}
 assert.throws(()=>verifyDailyWebhook(new Headers(),body,now));
 }finally{if(saved===undefined)delete process.env.DAILY_WEBHOOK_HMAC_BASE64;else process.env.DAILY_WEBHOOK_HMAC_BASE64=saved;}
});
test('reconnects, overlapping devices, duplicate IDs and unordered deliveries never inflate simultaneous time', () => {
 const events=[meeting,...session('creator','c',900,800),...session('fan','f1',1000,300),...session('fan','f2',1200,300),...session('fan','f3',1550,150)];
 const result=attendance([...events,...events].reverse(),room,start,end);
 assert.equal(result.creator_seconds,600);assert.equal(result.fan_seconds,550);assert.equal(result.simultaneous_seconds,550);assert.deepEqual(result.gaps,[]);assert.equal(result.settlement_eligible,false);
});
test('missing leaves/joins, unknown participants and contradictory timing remain incomplete', () => {
 const valid=[meeting,...session('creator','c',1000,600),...session('fan','f',1000,600)];
 for(const events of [valid.filter(e=>!(e.event_type==='participant.joined'&&e.payload.user_id==='fan')), valid.filter(e=>!(e.event_type==='participant.left'&&e.payload.user_id==='fan')), [...valid,...session('outsider','x',1000,600)],valid.filter(e=>e!==meeting),[...valid,event('participant.left',{user_id:'fan',session_id:'f',joined_at:1000,duration:999})]]){
 const result=attendance(events,room,start,end);assert.equal(result.evidence_status,'incomplete');assert.equal(result.settlement_eligible,false);assert.ok(result.gaps.length);}
});
test('normalize only supported events and exclude names, wallets and recording secrets', async () => {
 const body={version:'1.0.0',type:'participant.joined',id:'event',event_ts:1,payload:{room:'r',session_id:'s',user_id:'u',joined_at:1,user_name:'PRIVATE',share_token:'SECRET'}};
 assert.deepEqual(normalizedEvent(body).payload,{room:'r',user_id:'u',session_id:'s',joined_at:1});assert.equal(normalizedEvent({...body,type:'recording.ready-to-download'}),null);assert.throws(()=>normalizedEvent({...body,version:'2.0.0'}));
 await assert.rejects(boundedJSON(new Request('https://test',{method:'POST',body:'x'.repeat(101)}),100),/grande/);
});

test('Daily join and leave timestamps may differ by milliseconds; larger discrepancies stay incomplete', () => {
 const events=[meeting,...session('creator','c',1000,600),...session('fan','f',1000,600)];
 const left=events.find(e=>e.event_type==='participant.left'&&e.payload.user_id==='fan');left.payload.joined_at+=0.008;left.payload.duration-=0.008;
 const accepted=attendance(events,room,start,end);assert.deepEqual(accepted.gaps,[]);assert.ok(Math.abs(accepted.simultaneous_seconds-599.992)<0.0001);
 left.payload.joined_at+=0.2;assert.equal(attendance(events,room,start,end).evidence_status,'incomplete');
});
