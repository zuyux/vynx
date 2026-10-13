const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {LiteSVM,FailedTransactionMetadata}=require('litesvm');
const {getTransactionDecoder}=require('@solana/kit');
const {Keypair,PublicKey,Transaction,ComputeBudgetProgram}=require('@solana/web3.js');
const {MintLayout,AccountLayout}=require('@solana/spl-token');
const c=require('../scripts/booking-client.cjs');
function fixture() {
 const svm=new LiteSVM().withDefaultPrograms().withTransactionHistory(0n);
 const [admin,quote,resolver,payer,creator,stranger]=Array.from({length:6},()=>Keypair.generate());
 for(const k of [admin,quote,resolver,payer,creator,stranger])svm.airdrop(k.publicKey.toBase58(),2000000000n);
 svm.addProgramWithLoader(c.PROGRAM_ID.toBase58(),fs.readFileSync(path.join(__dirname,'../target/deploy/vynx_booking.so')),c.LOADER.toBase58());
 const pd=PublicKey.findProgramAddressSync([c.PROGRAM_ID.toBuffer()],c.LOADER)[0];
 const account=svm.getAccount(pd.toBase58()); const data=Buffer.from(account.data);data[12]=1;admin.publicKey.toBuffer().copy(data,13);svm.setAccount({...account,data});
 const mint=Keypair.generate().publicKey, source=Keypair.generate().publicKey, destination=Keypair.generate().publicKey;
 const mintData=Buffer.alloc(82);MintLayout.encode({mintAuthorityOption:0,mintAuthority:PublicKey.default,supply:100000000n,decimals:6,isInitialized:true,freezeAuthorityOption:0,freezeAuthority:PublicKey.default},mintData);
 function set(address,data){svm.setAccount({address:address.toBase58(),programAddress:c.TOKEN.toBase58(),data,lamports:svm.minimumBalanceForRentExemption(BigInt(data.length)),executable:false});}
 set(mint,mintData);
 function token(address,owner,amount){const data=Buffer.alloc(165);AccountLayout.encode({mint,owner,amount,delegateOption:0,delegate:PublicKey.default,state:1,isNativeOption:0,isNative:0n,delegatedAmount:0n,closeAuthorityOption:0,closeAuthority:PublicKey.default},data);set(address,data);}
 token(source,payer.publicKey,100000000n);token(destination,creator.publicKey,0n);
 function send(ix,signers=[payer]){const tx=new Transaction({feePayer:signers[0].publicKey,recentBlockhash:svm.latestBlockhash()}).add(ComputeBudgetProgram.setComputeUnitLimit({units:300000}),ix);tx.sign(...signers);return svm.sendTransaction(getTransactionDecoder().decode(tx.serialize()));}
 function ok(r){assert(!(r instanceof FailedTransactionMetadata),r instanceof FailedTransactionMetadata?r.meta().logs().join('\n'):'');}
 function fail(r){assert(r instanceof FailedTransactionMetadata,'expected transaction rejection');}
 function balance(address){return AccountLayout.decode(Buffer.from(svm.getAccount(address.toBase58()).data)).amount;}
 function time(now){const clock=svm.getClock();clock.unixTimestamp=BigInt(now);svm.setClock(clock);}
 time(1000);ok(send(c.initialize(admin.publicKey,quote.publicKey,resolver.publicKey,mint),[admin]));
 const id=randomBytes(16),terms={payer:payer.publicKey,quote:quote.publicKey,creator:creator.publicKey,mint,source,id,start:100000,end:101800,expires:1600};
 const fund=(overrides={})=>c.fund({...terms,...overrides});
 const settle=(name,who,amount=0n,receiver=destination)=>send(c.settlement(name,who.publicKey,id,mint,source,receiver,amount),[who]);
 return {svm,admin,quote,resolver,payer,creator,stranger,mint,source,destination,id,send,ok,fail,balance,time,fund,settle};
}
test('funding is atomic, quote-authorized and cannot charge twice',()=>{
 const f=fixture();f.fail(f.send(f.fund({quote:f.stranger.publicKey}),[f.payer,f.stranger]));assert.equal(f.balance(f.source),100000000n);
 assert.equal(f.svm.getAccount(c.booking(f.id).toBase58()).exists,false);
 assert.equal(f.svm.getAccount(c.vault(f.id).toBase58()).exists,false);
 f.ok(f.send(f.fund(),[f.payer,f.quote]));assert.equal(f.balance(f.source),99000000n);assert.equal(f.balance(c.vault(f.id)),1000000n);
 const receipt=Buffer.from(f.svm.getAccount(c.booking(f.id).toBase58()).data);
 assert(receipt.subarray(88,120).equals(f.creator.publicKey.toBuffer()));assert.equal(receipt[216],1);
 f.fail(f.send(f.fund(),[f.payer,f.quote]));assert.equal(f.balance(f.source),99000000n);
});
test('expiry, mint, amount and timing violations roll back account creation',()=>{
 for(const override of [{expires:999},{expires:1601},{amount:0n},{amount:1000000000n},{start:999},{end:100001},{mint:Keypair.generate().publicKey}]) {
  const f=fixture();f.fail(f.send(f.fund(override),[f.payer,f.quote]));assert.equal(f.balance(f.source),100000000n);assert.equal(f.svm.getAccount(c.booking(f.id).toBase58()).exists,false);
 }
});
test('dispute freezes participant refunds and resolver waits for dispute window',()=>{
 const f=fixture();f.ok(f.send(f.fund(),[f.payer,f.quote]));
 f.fail(f.send(c.dispute(f.stranger.publicKey,f.id),[f.stranger]));f.fail(f.settle('resolve',f.resolver,1000000n));
 f.ok(f.send(c.dispute(f.payer.publicKey,f.id),[f.payer]));f.fail(f.settle('refund',f.creator));
 f.time(101800+86400+1);f.fail(f.settle('resolve',f.stranger,1000000n));f.fail(f.settle('resolve',f.resolver,1000001n));
 f.ok(f.settle('resolve',f.resolver,400000n));assert.equal(f.balance(f.destination),400000n);assert.equal(f.balance(f.source),99600000n);
 f.fail(f.settle('resolve',f.resolver,400000n));f.fail(f.settle('refund',f.creator));assert.equal(f.balance(c.vault(f.id)),0n);
});
test('timely cancellation refunds payer; late cancellation does not; wrong recipient rejected',()=>{
 const f=fixture();f.ok(f.send(f.fund(),[f.payer,f.quote]));
 f.fail(f.settle('refund',f.creator,0n,f.source));f.time(100000-86400+1);f.fail(f.settle('refund',f.payer));
 f.ok(f.settle('refund',f.creator));assert.equal(f.balance(f.source),100000000n);f.fail(f.send(f.fund(),[f.payer,f.quote]));
});
test('resolver outage recovery refunds even disputed funds and prevents late resolver payout',()=>{
 const f=fixture();f.ok(f.send(f.fund(),[f.payer,f.quote]));f.ok(f.send(c.dispute(f.creator.publicKey,f.id),[f.creator]));
 f.time(101800+30*86400);f.fail(f.settle('resolve',f.resolver,1000000n));f.ok(f.settle('refund',f.payer));assert.equal(f.balance(f.source),100000000n);
});
test('only deployment authority may initialize configuration',()=>{
 const f=fixture();f.fail(f.send(c.initialize(f.stranger.publicKey,f.stranger.publicKey,f.stranger.publicKey,f.mint),[f.stranger]));
});
test('payer refund includes the cancellation deadline and rejects outsiders without moving funds',()=>{
 const f=fixture();f.ok(f.send(f.fund(),[f.payer,f.quote]));
 f.fail(f.settle('refund',f.stranger));
 f.time(100000-86400);f.ok(f.settle('refund',f.payer));
 assert.equal(f.balance(f.source),100000000n);assert.equal(f.balance(f.destination),0n);assert.equal(f.balance(c.vault(f.id)),0n);
 f.fail(f.settle('refund',f.payer));f.fail(f.settle('resolve',f.resolver));
 assert.equal(f.balance(f.source),100000000n);
});
test('normal settlement waits past the dispute deadline and conserves funds for every allocation',()=>{
 for(const amount of [0n,400000n,1000000n]){
  const f=fixture();f.ok(f.send(f.fund(),[f.payer,f.quote]));
  f.time(101800+86400);f.fail(f.settle('resolve',f.resolver,amount));
  assert.equal(f.balance(c.vault(f.id)),1000000n);
  f.time(101800+86400+1);f.ok(f.settle('resolve',f.resolver,amount));
  assert.equal(f.balance(f.destination),amount);assert.equal(f.balance(f.source),100000000n-amount);assert.equal(f.balance(c.vault(f.id)),0n);
  f.fail(f.settle('resolve',f.resolver,amount));f.fail(f.settle('refund',f.creator));
  assert.equal(f.balance(f.destination),amount);assert.equal(f.balance(f.source),100000000n-amount);
 }
});
test('disputed recovery becomes refundable exactly at its deadline',()=>{
 const f=fixture();f.ok(f.send(f.fund(),[f.payer,f.quote]));f.ok(f.send(c.dispute(f.payer.publicKey,f.id),[f.payer]));
 f.time(101800+30*86400-1);f.fail(f.settle('refund',f.payer));f.fail(f.settle('refund',f.creator));
 assert.equal(f.balance(c.vault(f.id)),1000000n);
 f.time(101800+30*86400);f.fail(f.settle('refund',f.stranger));f.ok(f.settle('refund',f.payer));
 assert.equal(f.balance(f.source),100000000n);assert.equal(f.balance(c.vault(f.id)),0n);
 f.fail(f.settle('resolve',f.resolver,1000000n));assert.equal(f.balance(f.destination),0n);
});
