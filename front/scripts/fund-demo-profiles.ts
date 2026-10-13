import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { Connection, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { createClient } from '@supabase/supabase-js';
import { configPda, decodeConfig } from '../lib/alias-registry';
import { DEVNET_GENESIS_HASH } from '../lib/alias-network';

type Profile = { alias: string; name: string; bio: string; id: string; wallet: string; socials?: {instagram:string;youtube:string;x:string} };
async function main() {
  const envPath = '.env.local', manifestPath = 'data/demo-profiles.json';
  const profiles: Profile[] = JSON.parse(readFileSync(manifestPath,'utf8'));
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', {commitment:'finalized',disableRetryOnRateLimit:true});
  if(await connection.getGenesisHash()!==DEVNET_GENESIS_HASH) throw Error('Devnet required.');
  const config=decodeConfig(await connection.getAccountInfo(configPda(),'finalized'));
  if(config.paused) throw Error('Alias registry is paused.');
  const phrase=process.env.TESTNET_PRIVATE_KEY?.trim().normalize('NFKD');
  if(!phrase || phrase.split(/\s+/).length!==12) throw Error('Configured devnet funding wallet recovery phrase required.');
  let derived=createHmac('sha512','ed25519 seed').update(pbkdf2Sync(phrase,'mnemonic',2048,64,'sha512')).digest();
  for(const index of [44,501,1,0]) {
    const data=Buffer.alloc(37);derived.subarray(0,32).copy(data,1);data.writeUInt32BE(index+0x80000000,33);
    derived=createHmac('sha512',derived.subarray(32)).update(data).digest();
  }
  const source=Keypair.fromSeed(derived.subarray(0,32));
  if(source.publicKey.toBase58()!==process.env.TESTNET_ADDRESS?.trim()) throw Error('Funding wallet derivation mismatch.');
  const db=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false}});
  let env=readFileSync(envPath,'utf8');
  const wallets=profiles.map(profile=>{
    const prefix=`VYNX_${profile.alias.toUpperCase()}`;
    const existing=env.match(new RegExp(`^${prefix}_PRIVATE_KEY=(.*)$`,'m'))?.[1]?.trim().replace(/^['"]|['"]$/g,'');
    const wallet=existing ? Keypair.fromSecretKey(bs58.decode(existing)) : Keypair.generate();
    if(!existing) env+=`\n# Devnet demo creator ${profile.alias}\n${prefix}_ADDRESS=${wallet.publicKey.toBase58()}\n${prefix}_PRIVATE_KEY=${bs58.encode(wallet.secretKey)}\n`;
    return wallet;
  });
  writeFileSync(envPath,env,{mode:0o600});chmodSync(envPath,0o600);
  for(let i=0;i<profiles.length;i++) {
    const profile=profiles[i],wallet=wallets[i];
    const {data:row,error}=await db.from('cards_users').select('id,wallet_address,design,claim_program').eq('id',profile.id).eq('username',profile.alias).single();
    if(error || !row || row.claim_program) throw Error(`Cannot update unclaimed demo profile ${profile.alias}.`);
    if(row.wallet_address!==profile.wallet && row.wallet_address!==wallet.publicKey.toBase58()) throw Error('Demo wallet mismatch.');
    const handle=profile.alias.replace('demo_','');
    profile.socials={instagram:`https://www.instagram.com/${handle}/`,youtube:`https://www.youtube.com/@${handle}`,x:`https://x.com/${handle}`};
    const {error:updateError}=await db.from('cards_users').update({wallet_address:wallet.publicKey.toBase58(),display_name:profile.name,bio:profile.bio,
      design:{...row.design,name:profile.name,bio:profile.bio,socials:profile.socials},tips_enabled:false,published:false})
      .eq('id',profile.id).eq('wallet_address',row.wallet_address);
    if(updateError) throw Error(`Profile update failed: ${profile.alias}.`);
    profile.wallet=wallet.publicKey.toBase58();
    writeFileSync(manifestPath,JSON.stringify(profiles,null,2)+'\n');
  }
  const receiptPath='data/demo-profile-funding.json';
  let receipt: {network:string;source:string;signature?:string;blockhash?:string;lastValidBlockHeight?:number;confirmed?:boolean;profiles?:unknown} = JSON.parse(readFileSyncExists(receiptPath));
  const save=()=>writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  if(receipt.signature && !receipt.confirmed) {
    const status=await connection.getSignatureStatuses([receipt.signature],{searchTransactionHistory:true});
    if(status.value[0]?.err) throw Error('Prior funding failed; inspect saved receipt before retrying.');
    if(status.value[0]?.confirmationStatus==='finalized') {receipt.confirmed=true;save();}
    else throw Error('Prior funding unresolved; reconcile saved signature before retrying.');
  }
  const targets=await Promise.all(profiles.map(async(profile,i)=>{
    const price=Number(config.tiers[Math.min(profile.alias.length,5)-1]);
    const target=price+20_000_000;
    const balance=await connection.getBalance(wallets[i].publicKey,'finalized');
    return {alias:profile.alias,address:profile.wallet,price_lamports:price,target_lamports:target,balance_lamports:balance,topup_lamports:Math.max(0,target-balance)};
  }));
  const needed=targets.reduce((sum,p)=>sum+p.topup_lamports,0);
  if(needed) {
    if(await connection.getBalance(source.publicKey,'finalized')<needed+100_000) throw Error('Funding wallet has insufficient devnet SOL.');
    const latest=await connection.getLatestBlockhash('finalized');
    const tx=new Transaction({feePayer:source.publicKey,...latest});
    targets.filter(p=>p.topup_lamports).forEach(p=>tx.add(SystemProgram.transfer({fromPubkey:source.publicKey,toPubkey:wallets[profiles.findIndex(profile=>profile.alias===p.alias)].publicKey,lamports:p.topup_lamports})));
    tx.sign(source);
    receipt={network:'devnet',source:source.publicKey.toBase58(),signature:bs58.encode(tx.signature!),...latest,profiles:targets};save();
    await connection.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:3});
    const result=await connection.confirmTransaction({...latest,signature:receipt.signature!},'finalized');
    if(result.value.err) throw Error('Funding transaction failed.');
    receipt.confirmed=true;save();
  }
  for(let i=0;i<targets.length;i++) targets[i].balance_lamports=await connection.getBalance(wallets[i].publicKey,'finalized');
  console.log(JSON.stringify({network:'devnet',funding_signature:receipt.signature,profiles:targets,keys_saved:envPath},null,2));
}
function readFileSyncExists(path:string) {try{return readFileSync(path,'utf8');}catch{return '{"network":"devnet","source":""}';}}
main().catch(error=>{console.error(error instanceof Error && !/https?:\/\//.test(error.message)?error.message:'Devnet setup failed; private credentials withheld.');process.exitCode=1;});
