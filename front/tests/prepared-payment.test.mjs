import test from 'node:test';
import assert from 'node:assert/strict';
import { ComputeBudgetProgram, Keypair, SystemProgram, Transaction, TransactionInstruction, TransactionMessage } from '@solana/web3.js';
import { matchesPreparedPayment } from '../lib/prepared-payment.ts';
const payer = Keypair.generate().publicKey, recipient = Keypair.generate().publicKey;
const transfer = SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 123 });
const prepared = new Transaction({ feePayer: payer, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(transfer);
const raw = message => ({ transaction: { message }, meta: { loadedAddresses: { writable: [], readonly: [] } } });
test('prepared payment accepts refreshed blockhash, wallet fee instructions and v0 encoding', () => {
  const actual = new TransactionMessage({ payerKey: payer, recentBlockhash: Keypair.generate().publicKey.toBase58(), instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }), transfer] });
  assert.equal(matchesPreparedPayment(prepared, raw(actual.compileToLegacyMessage())), true);
  assert.equal(matchesPreparedPayment(prepared, raw(actual.compileToV0Message())), true);
});
test('prepared payment rejects changed recipients, amounts, payer, additional transfers and malformed fee instructions', () => {
  const cases = [
    [SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 123 })],
    [SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 124 })],
    [transfer, transfer],
    [new TransactionInstruction({ programId: ComputeBudgetProgram.programId, keys: [], data: Buffer.from([3]) }), transfer],
    [ComputeBudgetProgram.requestHeapFrame({ bytes: 32768 }), transfer],
  ];
  for (const instructions of cases) assert.equal(matchesPreparedPayment(prepared, raw(new TransactionMessage({ payerKey: payer, recentBlockhash: prepared.recentBlockhash, instructions }).compileToLegacyMessage())), false);
  assert.equal(matchesPreparedPayment(prepared, raw(new TransactionMessage({ payerKey: Keypair.generate().publicKey, recentBlockhash: prepared.recentBlockhash, instructions: [transfer] }).compileToLegacyMessage())), false);
});
