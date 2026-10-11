const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { PublicKey, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const PROGRAM_ID = new PublicKey(fs.readFileSync(path.join(__dirname, '../booking-program-id.txt'), 'utf8').trim());
const LOADER = new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const disc = (type, name) => createHash('sha256').update(`${type}:${name}`).digest().subarray(0,8);
const pda = seeds => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
const config = () => pda([Buffer.from('config')]);
const booking = id => pda([Buffer.from('booking'),id]);
const vault = id => pda([Buffer.from('vault'),booking(id).toBuffer()]);
const key = (pubkey,isSigner=false,isWritable=false) => ({ pubkey,isSigner,isWritable });
const ix = (name, keys, args=Buffer.alloc(0)) => new TransactionInstruction({ programId: PROGRAM_ID, keys, data: Buffer.concat([disc('global',name),args]) });
function initialize(authority, quote, resolver, mint) {
  return ix('initialize',[key(authority,true,true),key(PROGRAM_ID),key(PublicKey.findProgramAddressSync([PROGRAM_ID.toBuffer()],LOADER)[0]),key(config(),false,true),key(mint),key(SystemProgram.programId)],Buffer.concat([quote.toBuffer(),resolver.toBuffer()]));
}
function fund({ payer,quote,creator,mint,source,id,hash=Buffer.alloc(32,1),amount=1000000n,start,end,expires }) {
  const args=Buffer.alloc(80); id.copy(args); hash.copy(args,16); args.writeBigUInt64LE(amount,48);args.writeBigInt64LE(BigInt(start),56);args.writeBigInt64LE(BigInt(end),64);args.writeBigInt64LE(BigInt(expires),72);
  return ix('fund',[key(payer,true,true),key(quote,true),key(config()),key(creator),key(booking(id),false,true),key(mint),key(source,false,true),key(vault(id),false,true),key(TOKEN),key(SystemProgram.programId)],args);
}
const dispute = (authority,id) => ix('dispute',[key(authority,true),key(booking(id),false,true)]);
function settlement(name,authority,id,mint,payerToken,creatorToken,amount=0n) {
  const data=Buffer.alloc(8);data.writeBigUInt64LE(amount);
  return ix(name,[key(authority,true),key(booking(id),false,true),key(mint),key(vault(id),false,true),key(payerToken,false,true),key(creatorToken,false,true),key(TOKEN)],name==='resolve'?data:Buffer.alloc(0));
}
const programDataPda=()=>PublicKey.findProgramAddressSync([PROGRAM_ID.toBuffer()],LOADER)[0];
module.exports={programDataPda,configPda:config,PROGRAM_ID,LOADER,TOKEN,config,booking,vault,initialize,fund,dispute,settlement};
