// Devnet administration/recovery only. Never accepts a mainnet endpoint.
const fs=require('node:fs');
const {Connection,PublicKey,Keypair,Transaction,sendAndConfirmTransaction}=require('@solana/web3.js');
const {getAssociatedTokenAddressSync,createAssociatedTokenAccountIdempotentInstruction}=require('@solana/spl-token');
const c=require('./booking-client.cjs');
const GENESIS='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const MINT=new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
(async()=>{
 const connection=new Connection(process.env.VYNX_DEVNET_RPC_URL||'https://api.devnet.solana.com','finalized');
 if(await connection.getGenesisHash()!==GENESIS)throw Error('Booking operations require Solana devnet.');
 const command=process.argv[2];
 const signer=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(process.env.VYNX_BOOKING_AUTHORITY_KEYPAIR_PATH||'.wallets/devnet-deployer.json','utf8'))));
 const tx=new Transaction();
 if(command==='initialize') {
  if(!process.env.VYNX_BOOKING_QUOTE_AUTHORITY||!process.env.VYNX_BOOKING_RESOLVER)throw Error('Set quote authority and resolver public keys explicitly.');
  tx.add(c.initialize(signer.publicKey,new PublicKey(process.env.VYNX_BOOKING_QUOTE_AUTHORITY),new PublicKey(process.env.VYNX_BOOKING_RESOLVER),MINT));
 } else {
  const value=process.argv[3];
  if(!value||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value))throw Error('Supply booking UUID.');
  const id=Buffer.from(value.replaceAll('-',''),'hex');
  const info=await connection.getAccountInfo(c.booking(id),'finalized');
  if(!info?.owner.equals(c.PROGRAM_ID)||info.data.length!==226)throw Error('Booking receipt not found.');
  const payer=new PublicKey(info.data.subarray(56,88)),creator=new PublicKey(info.data.subarray(88,120));
  if(command==='dispute')tx.add(c.dispute(signer.publicKey,id));
  else if(command==='refund'||command==='resolve') {
   const payerToken=getAssociatedTokenAddressSync(MINT,payer),creatorToken=getAssociatedTokenAddressSync(MINT,creator);
   for(const [account,owner] of [[payerToken,payer],[creatorToken,creator]])tx.add(createAssociatedTokenAccountIdempotentInstruction(signer.publicKey,account,owner,MINT));
   const units=process.argv[4]||'0';if(!/^\d{1,10}$/.test(units))throw Error('Supply exact creator allocation in integer USDC units.');
   tx.add(c.settlement(command,signer.publicKey,id,MINT,payerToken,creatorToken,BigInt(units)));
  }else throw Error('Use initialize, dispute, refund or resolve.');
 }
 const signature=await sendAndConfirmTransaction(connection,tx,[signer],{commitment:'finalized'});
 const state=command==='initialize'?await connection.getAccountInfo(c.config(),'finalized'):await connection.getAccountInfo(c.booking(Buffer.from(process.argv[3].replaceAll('-',''),'hex')),'finalized');
 if(!state?.owner.equals(c.PROGRAM_ID))throw Error(`Transaction finalized but state verification failed. Preserve signature ${signature}.`);
 console.log(JSON.stringify({cluster:'devnet',command,signature,program:c.PROGRAM_ID.toBase58(),state:command==='initialize'?'configured':state.data[216]}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
