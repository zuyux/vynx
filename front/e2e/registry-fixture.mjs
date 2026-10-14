import fs from 'node:fs';
import { createRequire } from 'node:module';
import { LiteSVM, FailedTransactionMetadata } from 'litesvm';
import { getTransactionDecoder } from '@solana/kit';
import { Keypair, Transaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
const require = createRequire(import.meta.url);
const c = require('../../chain/scripts/client.cjs');
export function registryFixture({ sponsor, treasury }) {
  const svm = new LiteSVM();
  const admin = Keypair.generate();
  for (const key of [admin.publicKey, sponsor.publicKey, new PublicKey(treasury)]) svm.airdrop(key.toBase58(), 10_000_000_000n);
  svm.addProgramWithLoader(c.PROGRAM_ID.toBase58(), fs.readFileSync(new URL('../../chain/target/deploy/vynx_alias.so', import.meta.url)), c.LOADER.toBase58());
  const programData = svm.getAccount(c.programDataPda().toBase58());
  const data = Buffer.from(programData.data); data[12] = 1; admin.publicKey.toBuffer().copy(data, 13); svm.setAccount({ ...programData, data });
  function sendAdmin(instruction) {
    const tx = new Transaction({ feePayer: admin.publicKey, recentBlockhash: svm.latestBlockhash() }).add(instruction); tx.sign(admin);
    const result = svm.sendTransaction(getTransactionDecoder().decode(tx.serialize()));
    if (result instanceof FailedTransactionMetadata) throw new Error(result.meta().logs().join('\n'));
  }
  sendAdmin(c.initializeIx(admin.publicKey, admin.publicKey, sponsor.publicKey, new PublicKey(treasury)));
  const slot = () => Number(svm.getClock().slot);
  const account = address => {
    const value = svm.getAccount(address);
    return value.exists ? { data: [Buffer.from(value.data).toString('base64'), 'base64'], owner: value.programAddress, executable: !!value.executable, lamports: Number(value.lamports), rentEpoch: 0, space: value.data.length } : null;
  };
  function submit(tx) {
    const message = tx.compileMessage();
    const pre = message.accountKeys.map(key => Number(svm.getBalance(key.toBase58()) ?? 0n));
    const result = svm.sendTransaction(getTransactionDecoder().decode(tx.serialize()));
    const failed = result instanceof FailedTransactionMetadata;
    const meta = failed ? result.meta() : result;
    return { slot: slot(), blockTime: Math.floor(Date.now() / 1000), version: 'legacy', meta: { err: failed ? { InstructionError: [2, 'Custom'] } : null, fee: 10200, preBalances: pre, postBalances: message.accountKeys.map(key => Number(svm.getBalance(key.toBase58()) ?? 0n)), innerInstructions: [], logMessages: meta.logs() }, transaction: { signatures: tx.signatures.map(value => bs58.encode(value.signature)), message: { header: message.header, accountKeys: message.accountKeys.map(key => key.toBase58()), instructions: message.instructions, recentBlockhash: message.recentBlockhash } } };
  }
  function rpc(method, params) {
    switch (method) {
      case 'getLatestBlockhash': return { context: { slot: slot() }, value: { blockhash: svm.latestBlockhash(), lastValidBlockHeight: slot() + 150 } };
      case 'getSlot': case 'getBlockHeight': return slot();
      case 'getBalance': return { context: { slot: slot() }, value: Number(svm.getBalance(params[0]) ?? 0n) };
      case 'getAccountInfo': return { context: { slot: slot() }, value: account(params[0]) };
      case 'getMultipleAccounts': return { context: { slot: slot() }, value: params[0].map(account) };
      case 'simulateTransaction': {
        const decoded = getTransactionDecoder().decode(Buffer.from(params[0], 'base64'));
        svm.withSigverify(false);
        let result; try { result = svm.simulateTransaction(decoded); } finally { svm.withSigverify(true); }
        return { context: { slot: slot() }, value: { err: result instanceof FailedTransactionMetadata ? { InstructionError: [2, 'Custom'] } : null, logs: result.meta().logs(), accounts: null, unitsConsumed: Number(result.meta().computeUnitsConsumed()), returnData: null } };
      }
      case 'getFeeForMessage': return { context: { slot: slot() }, value: 10200 };
      default: return undefined;
    }
  }
  function control(body) {
    if (body.prices) sendAdmin(c.pricesIx(admin.publicKey, body.prices.map(BigInt)));
    if (body.advance) { const clock = svm.getClock(); clock.slot += BigInt(body.advance); svm.setClock(clock); svm.expireBlockhash(); }
    if (body.corruptOwner) { const address = c.ownerPda(new PublicKey(body.corruptOwner)).toBase58(); const info = svm.getAccount(address); const data = Buffer.from(info.data); Keypair.generate().publicKey.toBuffer().copy(data, 40); svm.setAccount({ ...info, data }); }
    return { slot: slot() };
  }
  return { submit, rpc, control };
}
