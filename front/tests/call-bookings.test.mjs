import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicKey, Keypair } from '@solana/web3.js';
import { callSlots, availableCallSlots } from '../lib/call-slots.ts';
import { assertEscrowReceipt, bookingAddresses, discriminator, escrowProgram, termsHash } from '../lib/booking-escrow.ts';
import { DEVNET_USDC_MINT } from '../lib/tip-currency.ts';
const offer = { accepting: true, duration_minutes: 30, timezone: 'America/Lima', availability: [{weekday:1,start:'09:00',end:'10:00'}] };
test('slots honor timezone, boundaries, lead time and overlapping occupied intervals',()=>{
 const slots=callSlots(offer,Date.parse('2026-10-12T13:00:00Z'),1);
 assert.deepEqual(slots,['2026-10-12T14:00:00.000Z','2026-10-12T14:15:00.000Z','2026-10-12T14:30:00.000Z']);
 assert.deepEqual(availableCallSlots(slots,30,[{starts_at:slots[0],ends_at:'2026-10-12T14:30:00Z'}]),[slots[2]]);
 assert.deepEqual(callSlots({...offer,accepting:false}),[]);
 assert.deepEqual(callSlots(offer,Date.parse('2026-10-12T14:20:00Z'),1),[]);
});
test('DST gaps produce no nonexistent times; repeated times retain distinct UTC instants',()=>{
 const schedule={accepting:true,duration_minutes:30,timezone:'America/New_York',availability:[{weekday:0,start:'01:00',end:'04:00'}]};
 const fall=callSlots(schedule,Date.parse('2026-11-01T04:00:00Z'),1);
 assert(fall.includes('2026-11-01T05:00:00.000Z'));assert(fall.includes('2026-11-01T06:00:00.000Z'));
 assert(!fall.includes('2026-11-01T05:45:00.000Z'));
 const spring=callSlots(schedule,Date.parse('2026-03-08T05:00:00Z'),1);
 assert(!spring.includes('2026-03-08T06:45:00.000Z'));assert(spring.includes('2026-03-08T07:00:00.000Z'));
});
function receiptFixture(){
 const program=Keypair.generate().publicKey,payer=Keypair.generate().publicKey,creator=Keypair.generate().publicKey,resolver=Keypair.generate().publicKey;
 const b={id:'12345678-1234-1234-1234-123456789abc',offer_id:'offer',payer_wallet:payer.toBase58(),creator_wallet:creator.toBase58(),starts_at:'2026-10-12T14:00:00.000Z',ends_at:'2026-10-12T14:30:00.000Z',expires_at:'2026-10-11T14:10:00.000Z',terms:{policy:'v1'},price_units:12000001};
 const data=Buffer.alloc(226);discriminator('account','Booking').copy(data);Buffer.from(b.id.replaceAll('-',''),'hex').copy(data,8);termsHash(b).copy(data,24);
 [payer,creator,new PublicKey(DEVNET_USDC_MINT),resolver].forEach((k,i)=>k.toBuffer().copy(data,56+i*32));
 data.writeBigUInt64LE(BigInt(b.price_units),184);data.writeBigInt64LE(BigInt(Date.parse(b.starts_at)/1000),192);data.writeBigInt64LE(BigInt(Date.parse(b.ends_at)/1000),200);data.writeBigInt64LE(BigInt(Date.parse(b.expires_at)/1000),208);data[216]=1;
 return {program,b,resolver,info:{owner:program,data}};
}
test('escrow receipt binds payer, creator, mint, exact amount, schedule, policy and expiry',()=>{
 const f=receiptFixture();assert.doesNotThrow(()=>assertEscrowReceipt(f.info,f.program,f.b,f.resolver));
 for(const offset of [0,8,24,56,88,120,152,184,192,200,216]){
  const data=Buffer.from(f.info.data);data[offset]^=128;assert.throws(()=>assertEscrowReceipt({...f.info,data},f.program,f.b,f.resolver));
 }
 const late=Buffer.from(f.info.data);late.writeBigInt64LE(BigInt(Date.parse(f.b.expires_at)/1000+1),208);assert.throws(()=>assertEscrowReceipt({...f.info,data:late},f.program,f.b));
 assert.throws(()=>assertEscrowReceipt({...f.info,owner:Keypair.generate().publicKey},f.program,f.b));
 assert.throws(()=>assertEscrowReceipt(f.info,f.program,{...f.b,terms:{policy:'tampered'}}));
 const a=bookingAddresses(f.program,f.b.id);assert(!a.booking.equals(a.vault));
});
test('hosted devnet escrow requires an explicit hackathon opt-in',()=>{
 const old={...process.env};
 try{delete process.env.VYNX_BOOKING_HACKATHON;process.env.NODE_ENV='production';process.env.VYNX_BOOKING_ESCROW_ENABLED='true';process.env.VYNX_BOOKING_PROGRAM_ID=Keypair.generate().publicKey.toBase58();assert.throws(()=>escrowProgram(),e=>e.code==='BOOKING_DISABLED');process.env.VYNX_BOOKING_HACKATHON='true';assert.equal(escrowProgram().toBase58(),process.env.VYNX_BOOKING_PROGRAM_ID);}
 finally{for(const key of ['NODE_ENV','VYNX_BOOKING_ESCROW_ENABLED','VYNX_BOOKING_PROGRAM_ID','VYNX_BOOKING_HACKATHON']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
