import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationEmail, notificationEmailSettings } from '../lib/notification-email.ts';
import { GET, PUT } from '../app/api/notification-email/route.ts';

test('notification emails validate format, preserve the local part, and prefer Privy over the private fallback', () => {
  assert.equal(notificationEmail(' Creator+news@Example.COM '), 'Creator+news@example.com');
  for (const value of [null, '', '   ']) assert.equal(notificationEmail(value), null);
  for (const value of [undefined, 1, 'no-at', 'a@localhost', '.name@example.com', 'a..b@example.com', 'a@-example.com', 'a@example.com\r\nBcc:b@example.com', 'a'.repeat(65)+'@example.com', 'Name <name@example.com>']) assert.throws(() => notificationEmail(value));
  assert.deepEqual(notificationEmailSettings(null), { email: null, source: null });
  assert.deepEqual(notificationEmailSettings({ notification_email:'fallback@example.com' }), { email:'fallback@example.com', source:'manual' });
  assert.deepEqual(notificationEmailSettings({ privy_email:'privy@example.com', notification_email:'fallback@example.com', privy_user_id:'private' }), { email:'privy@example.com', source:'privy' });
});
test('notification email API scopes reads/writes to the session and cannot forge or override a Privy email', async () => {
  const keys=['SUPABASE_URL','SUPABASE_SECRET_KEY','NEXT_PUBLIC_APP_URL'];
  const saved=keys.map(key=>process.env[key]), original=globalThis.fetch;
  const origin='https://vynx.test', wallet='signed-wallet';
  Object.assign(process.env,{SUPABASE_URL:'https://email.supabase.co',SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_APP_URL:origin});
  let stored=null, writes=0, privy=false;
  globalThis.fetch=async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url),name=url.pathname.split('/').at(-1);
    if(name==='consume_public_endpoint_limit')return Response.json({allowed:true,retry_after:60});
    if(name==='wallet_sessions')return Response.json([{wallet}]);
    if(name==='account_notification_settings'){
      assert.equal(url.searchParams.get('wallet'),`eq.${wallet}`);
      assert.equal(url.searchParams.get('select'),'privy_email,notification_email');
      return Response.json(stored);
    }
    if(name==='save_notification_email'){
      const args=await request.json();assert.equal(args.owner_wallet,wallet);
      if(privy)return Response.json({code:'22023',message:'Privy email already set'},{status:400});
      writes++;stored={privy_email:null,notification_email:args.email};return Response.json(stored);
    }
    throw Error(name);
  };
  const headers={origin,cookie:`vynx-session=${'a'.repeat(64)}`};
  const request=(body,extra={})=>new Request(`${origin}/api/notification-email`,{method:'PUT',headers:{...headers,...extra},body:JSON.stringify(body)});
  try {
    assert.equal((await GET(new Request(`${origin}/api/notification-email`))).status,401);
    const empty=await GET(new Request(`${origin}/api/notification-email?wallet=other-wallet`,{headers}));
    assert.equal(empty.headers.get('cache-control'),'no-store');assert.deepEqual(await empty.json(),{settings:{email:null,source:null}});
    assert.equal((await PUT(request({wallet,email:'a@example.com'},{origin:'https://attacker.example'}))).status,403);
    assert.equal((await PUT(request({wallet,email:'a@example.com'},{cookie:''}))).status,401);
    assert.equal((await PUT(request({wallet:'other-wallet',email:'a@example.com'}))).status,409);
    assert.equal((await PUT(request({wallet,email:'a@example.com',privy_email:'forged@example.com'}))).status,400);
    assert.equal((await PUT(request({wallet,email:'not-an-email'}))).status,400);
    assert.equal(writes,0);
    const saved=await PUT(request({wallet,email:'Creator@EXAMPLE.COM'}));
    assert.equal(saved.status,200);assert.deepEqual(await saved.json(),{settings:{email:'Creator@example.com',source:'manual'}});
    assert.equal((await PUT(request({wallet,email:''}))).status,200);assert.equal(stored.notification_email,null);
    stored={privy_email:'from-privy@example.com',notification_email:null};privy=true;
    assert.equal((await PUT(request({wallet,email:'new@example.com'}))).status,409);
    assert.deepEqual(await(await GET(new Request(`${origin}/api/notification-email`,{headers}))).json(),{settings:{email:'from-privy@example.com',source:'privy'}});
  } finally {globalThis.fetch=original;keys.forEach((key,index)=>saved[index]===undefined ? delete process.env[key] : process.env[key]=saved[index]);}
});
