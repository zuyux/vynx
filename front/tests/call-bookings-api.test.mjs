import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { GET, POST } from '../app/api/bookings/route.ts';
import { bookingAddresses, discriminator, termsHash } from '../lib/booking-escrow.ts';
import { DEVNET_GENESIS_HASH } from '../lib/alias-network.ts';
import { DEVNET_USDC_MINT } from '../lib/tip-currency.ts';
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test('booking API binds session, reuses checkout and verifies finalized transaction plus receipt',async()=>{
 const keys=['NODE_ENV','SUPABASE_URL','SUPABASE_SECRET_KEY','NEXT_PUBLIC_APP_URL','NEXT_PUBLIC_SOLANA_RPC_URL','VYNX_BOOKING_ESCROW_ENABLED','VYNX_BOOKING_PROGRAM_ID','VYNX_BOOKING_QUOTE_SECRET','VYNX_ALIAS_REGISTRY_ENABLED'];
 const saved=keys.map(k=>process.env[k]),originalFetch=globalThis.fetch;
 const payer=Keypair.generate(),creator=Keypair.generate(),quote=Keypair.generate(),resolver=Keypair.generate(),program=Keypair.generate().publicKey;
 const origin='https://vynx.example',id='12345678-1234-1234-1234-123456789abc';
 const starts=new Date(Math.ceil((Date.now()+86400000)/900000)*900000).toISOString();
 const offer={id:'11111111-1111-1111-1111-111111111111',creator_wallet:creator.publicKey.toBase58(),title:'Portfolio call',description:'Review your portfolio and next steps.',duration_minutes:30,price_units:1000000,currency:'USDC',cluster:'devnet',timezone:'UTC',availability:[],accepting:true,updated_at:new Date().toISOString()};
 let booking=null,receipt=null,chainTx=null,confirmations=0;
 const addresses=bookingAddresses(program,id),config=Buffer.alloc(105);
 discriminator('account','Config').copy(config);quote.publicKey.toBuffer().copy(config,8);resolver.publicKey.toBuffer().copy(config,40);new PublicKey(DEVNET_USDC_MINT).toBuffer().copy(config,72);
 const account=(data,executable=false)=>({data:[data.toString('base64'),'base64'],owner:program.toBase58(),executable,lamports:10000000,rentEpoch:0});
 const server=createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk;const rpc=JSON.parse(raw);let result;
  if(rpc.method==='getGenesisHash')result=DEVNET_GENESIS_HASH;
  else if(rpc.method==='getLatestBlockhash')result={context:{slot:10},value:{blockhash:payer.publicKey.toBase58(),lastValidBlockHeight:150}};
  else if(rpc.method==='getAccountInfo')result={context:{slot:10},value:rpc.params[0]===addresses.config.toBase58()?account(config):rpc.params[0]===program.toBase58()?account(Buffer.alloc(0),true):receipt?account(receipt):null};
  else if(rpc.method==='getTransaction')result=chainTx;
  else throw Error(`Unexpected RPC ${rpc.method}`);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 Object.assign(process.env,{NODE_ENV:'test',SUPABASE_URL:'https://booking.supabase.co',SUPABASE_SECRET_KEY:'test',NEXT_PUBLIC_APP_URL:origin,NEXT_PUBLIC_SOLANA_RPC_URL:`http://127.0.0.1:${server.address().port}`,VYNX_BOOKING_ESCROW_ENABLED:'true',VYNX_BOOKING_PROGRAM_ID:program.toBase58(),VYNX_BOOKING_QUOTE_SECRET:JSON.stringify([...quote.secretKey]),VYNX_ALIAS_REGISTRY_ENABLED:'false'});
 globalThis.fetch=async(input,init)=>{
  const req=new Request(input,init),url=new URL(req.url);if(url.hostname!=='booking.supabase.co')return originalFetch(input,init);
  const name=url.pathname.split('/').at(-1);
  if(name==='consume_public_endpoint_limit')return json({allowed:true,retry_after:60});
  if(name==='wallet_sessions')return json([{wallet:payer.publicKey.toBase58(),expires_at:new Date(Date.now()+100000).toISOString()}]);
  if(name==='cards_users'){assert.equal(url.searchParams.get('select'),'wallet_address');return json([{wallet_address:creator.publicKey.toBase58()}]);}
  if(name==='call_offers')return json([offer]);
  if(name==='call_bookings')return json(url.searchParams.has('id')&&booking?[booking]:[]);
  const args=await req.json();
  if(name==='reserve_call'){
   assert.equal(args.payer,payer.publicKey.toBase58());
   booking??={id,offer_id:offer.id,creator_wallet:offer.creator_wallet,payer_wallet:args.payer,starts_at:args.slot,ends_at:new Date(Date.parse(args.slot)+1800000).toISOString(),expires_at:new Date(Math.floor((Date.now()+600000)/1000)*1000).toISOString(),terms:{policy:'vynx-escrow-devnet-v1'},price_units:1000000,state:'awaiting_payment',transaction:null,last_valid_block_height:null,payment_signature:null};return json(booking);
  }
  if(name==='prepare_call_payment'){booking.transaction??=args.encoded_transaction;booking.last_valid_block_height??=args.valid_height;return json(booking);}
  if(name==='confirm_call_payment'){confirmations++;booking.state='confirmed';booking.payment_signature=args.signature;return json(booking);}
  throw Error(`Unexpected database ${name}`);
 };
 const request=(body,headers={})=>new Request(`${origin}/api/bookings`,{method:'POST',headers:{origin,'Content-Type':'application/json',cookie:`vynx-session=${'a'.repeat(64)}`,...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await POST(request({action:'reserve'},{origin:'https://attacker.example'}))).status,403);
  assert.equal((await POST(request({action:'reserve'},{cookie:''}))).status,401);
  assert.equal((await POST(request({action:'reserve',alias:'alice',slot:starts}))).status,400);
  assert.equal((await POST(request({action:'reserve',alias:'alice',slot:starts,accepted_policy:'vynx-escrow-devnet-v1'}))).status,200);
  const first=await(await POST(request({action:'checkout',id}))).json(),second=await(await POST(request({action:'checkout',id}))).json();
  assert.equal(first.transaction,second.transaction);assert.equal(first.booking.payer_wallet,undefined);
  const tx=Transaction.from(Buffer.from(first.transaction,'base64'));assert(tx.signatures.some(s=>s.publicKey.equals(quote.publicKey)&&s.signature));tx.partialSign(payer);
  const signature=bs58.encode(tx.signature),message=tx.compileMessage();
  const pending=await POST(request({action:'confirm',id,signature}));assert.equal(pending.status,409);assert.equal((await pending.json()).code,'PAYMENT_PENDING');assert.equal(confirmations,0);
  chainTx={slot:10,blockTime:Math.floor(Date.now()/1000),version:'legacy',meta:{err:null,fee:5000,preBalances:message.accountKeys.map(()=>10000000),postBalances:message.accountKeys.map(()=>10000000),innerInstructions:[],logMessages:[],preTokenBalances:[],postTokenBalances:[]},transaction:{signatures:tx.signatures.map(s=>bs58.encode(s.signature)),message:{header:message.header,accountKeys:message.accountKeys.map(k=>k.toBase58()),recentBlockhash:message.recentBlockhash,instructions:message.instructions}}};
  assert.equal((await POST(request({action:'confirm',id,signature}))).status,409);assert.equal(confirmations,0);
  receipt=Buffer.alloc(226);discriminator('account','Booking').copy(receipt);Buffer.from(id.replaceAll('-',''),'hex').copy(receipt,8);termsHash(booking).copy(receipt,24);
  [payer.publicKey,creator.publicKey,new PublicKey(DEVNET_USDC_MINT),resolver.publicKey].forEach((k,i)=>k.toBuffer().copy(receipt,56+i*32));
  receipt.writeBigUInt64LE(1000000n,184);receipt.writeBigInt64LE(BigInt(Date.parse(booking.starts_at)/1000),192);receipt.writeBigInt64LE(BigInt(Date.parse(booking.ends_at)/1000),200);receipt.writeBigInt64LE(BigInt(Math.floor(Date.now()/1000)),208);receipt[216]=1;
  assert.equal((await POST(request({action:'confirm',id,signature}))).status,200);
  assert.equal((await POST(request({action:'confirm',id,signature}))).status,200);assert.equal(confirmations,2);
  chainTx.meta.err={InstructionError:[0,'Custom']};assert.equal((await POST(request({action:'confirm',id,signature}))).status,400);assert.equal(confirmations,2);
  assert.equal((await GET(new Request(`${origin}/api/bookings?id=${id}`))).status,401);
 }finally{
  globalThis.fetch=originalFetch;keys.forEach((key,i)=>{if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];});
  await new Promise(resolve=>server.close(resolve));
 }
});
