import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { LiteSVM, FailedTransactionMetadata } from 'litesvm';
import { getTransactionDecoder } from '@solana/kit';
import { Keypair, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { registerInstruction, aliasPda, ownerPda, verifyOwnershipAccounts } from '../lib/alias-registry.ts';
const c = createRequire(import.meta.url)('../../chain/scripts/client.cjs');

test('sponsor funds an empty wallet atomically and the owner must sign', () => {
  const svm = new LiteSVM();
  const admin = Keypair.generate(), sponsor = Keypair.generate(), treasury = Keypair.generate(), owner = Keypair.generate();
  for (const key of [admin, sponsor, treasury]) svm.airdrop(key.publicKey.toBase58(), 2000000000n);
  svm.addProgramWithLoader(c.PROGRAM_ID.toBase58(), readFileSync(new URL('../../chain/target/deploy/vynx_alias.so', import.meta.url)), c.LOADER.toBase58());
  const account = svm.getAccount(c.programDataPda().toBase58());
  const data = Buffer.from(account.data); data[12] = 1; admin.publicKey.toBuffer().copy(data, 13); svm.setAccount({ ...account, data });
  function send(instructions, signers) {
    const tx = new Transaction({ feePayer: sponsor.publicKey, recentBlockhash: svm.latestBlockhash() }).add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }), ...instructions);
    tx.sign(...signers);
    return svm.sendTransaction(getTransactionDecoder().decode(tx.serialize({ requireAllSignatures: false })));
  }
  function ok(result) { assert(!(result instanceof FailedTransactionMetadata), result instanceof FailedTransactionMetadata ? result.meta().logs().join('\n') : ''); }
  ok(send([c.initializeIx(admin.publicKey, admin.publicKey, sponsor.publicKey, treasury.publicKey)], [sponsor, admin]));
  const price = 10000000n;
  const funding = SystemProgram.transfer({ fromPubkey: sponsor.publicKey, toPubkey: owner.publicKey, lamports: price });
  const register = registerInstruction(owner.publicKey, sponsor.publicKey, treasury.publicKey, 'freeclaim', price, 1n, svm.getClock().slot + 100n, Buffer.alloc(16, 9));
  assert.throws(() => send([funding, register], [sponsor]), /missing signatures/);
  assert.equal(svm.getBalance(owner.publicKey.toBase58()) ?? 0n, 0n);
  const invalid = registerInstruction(owner.publicKey, sponsor.publicKey, treasury.publicKey, 'freeclaim', price + 1n, 1n, svm.getClock().slot + 100n, Buffer.alloc(16, 9));
  assert(send([funding, invalid], [sponsor, owner]) instanceof FailedTransactionMetadata);
  assert.equal(svm.getBalance(owner.publicKey.toBase58()) ?? 0n, 0n);
  const before = svm.getBalance(sponsor.publicKey.toBase58());
  ok(send([funding, register], [sponsor, owner]));
  assert.equal(svm.getBalance(owner.publicKey.toBase58()) ?? 0n, 0n);
  assert(svm.getBalance(sponsor.publicKey.toBase58()) <= before - price);
  const info = key => { const a = svm.getAccount(key.toBase58()); return { owner: new PublicKey(a.programAddress), data: Buffer.from(a.data), executable: false }; };
  assert.equal(verifyOwnershipAccounts('freeclaim', owner.publicKey, info(aliasPda('freeclaim')), info(ownerPda(owner.publicKey))).price, price);
});
