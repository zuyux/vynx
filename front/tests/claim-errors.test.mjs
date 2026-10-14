import test from 'node:test';
import assert from 'node:assert/strict';
import { claimErrorMessage } from '../lib/claim-errors.ts';
import { claimRpc, claimRpcFetch } from '../lib/claim-rpc.ts';
import { verifyClaimPayment } from '../lib/alias-claim.ts';
import { PublicKey } from '@solana/web3.js';
import { MEMO_PROGRAM } from '../lib/sol-payment.ts';

test('claim errors give distinct next steps for rejection, cancellation and insufficient funds', () => {
  assert.match(claimErrorMessage({ code: 4001 }, 'sign-in', false), /approve the sign-in message/);
  assert.match(claimErrorMessage({ code: '4001' }, 'send', false), /approve the alias payment/);
  assert.match(claimErrorMessage(new Error('User rejected the sign-in message'), 'sign-in', false), /signature was rejected/);
  assert.match(claimErrorMessage({ message: 'Popup closed' }, 'send', false), /cancelled.*Try again/);
  assert.match(claimErrorMessage({ message: 'Transaction simulation failed: insufficient funds for rent' }, 'send', false), /Add devnet SOL.*network fees/);
  assert.match(claimErrorMessage({ code: -32003 }, 'send', false), /Reconnect your wallet on Solana devnet/);
});

test('claim conflicts, timeouts and submitted payments preserve appropriate recovery guidance', () => {
  assert.match(claimErrorMessage({ code: 'ALIAS_TAKEN' }, 'prepare', false), /Choose a different alias/);
  assert.match(claimErrorMessage({ code: 'ALIAS_TAKEN' }, 'verify', true), /Keep your payment signature and contact support/);
  assert.match(claimErrorMessage({ code: 'RPC_TIMEOUT' }, 'prepare', false), /Wait a moment, then try again/);
  assert.match(claimErrorMessage({ code: 'RPC_TIMEOUT' }, 'verify', true), /Retry verification instead of paying again/);
  assert.match(claimErrorMessage({ code: 'RPC_TIMEOUT' }, 'send', false), /Check your wallet activity/);
  assert.match(claimErrorMessage({ code: 'INSUFFICIENT_PAYMENT' }, 'verify', true), /below the required.*contact support/);
  assert.match(claimErrorMessage({ code: 'PAYMENT_PENDING' }, 'verify', true), /not confirmed.*Retry verification/);
  assert.match(claimErrorMessage({ code: 'PAYMENT_FAILED' }, 'verify', true), /try claiming again/);
  assert.match(claimErrorMessage(new Error('unexpected'), 'verify', true), /Retry verification instead of paying again/);
});

test('claim payment verification identifies underpayment and rejects altered payments', () => {
  const account = '11111111111111111111111111111111';
  const treasury = 'So11111111111111111111111111111111111111112';
  const payment = amount => ({ meta: { err: null, preBalances: [100000, 0], postBalances: [100000 - amount, amount] }, transaction: { message: {
    accountKeys: [{ signer: true, pubkey: new PublicKey(account) }, { signer: false, pubkey: new PublicKey(treasury) }],
    instructions: [{ program: 'system', parsed: { type: 'transfer', info: { source: account, destination: treasury, lamports: amount } } }, { programId: MEMO_PROGRAM, parsed: 'vynx:claim:alice' }],
  } } });
  assert.doesNotThrow(() => verifyClaimPayment(payment(10000), account, treasury, 'alice'));
  assert.throws(() => verifyClaimPayment(payment(1), account, treasury, 'alice'), error => error.code === 'INSUFFICIENT_PAYMENT' && error.status === 400);
  assert.throws(() => verifyClaimPayment(payment(10000), account, treasury, 'other'), error => error.code === 'PAYMENT_MISMATCH');
  assert.throws(() => verifyClaimPayment(payment(20000), account, treasury, 'alice'), error => error.code === 'PAYMENT_MISMATCH');
});

test('RPC network and HTTP failures produce structured retryable errors', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(claimRpcFetch('https://rpc.test'), error => error.code === 'RPC_UNAVAILABLE' && error.status === 503);
    globalThis.fetch = async () => new Response('upstream failure', { status: 503 });
    await assert.rejects(claimRpcFetch('https://rpc.test'), error => error.code === 'RPC_UNAVAILABLE');
    await assert.rejects(claimRpc(async () => { throw new Error('JSON RPC failure'); }), error => error.code === 'RPC_UNAVAILABLE');
  } finally { globalThis.fetch = original; }
});

test('RPC response body stalls are aborted and reported as timeouts', async () => {
  const original = globalThis.fetch;
  const keepAlive = setInterval(() => {}, 1000);
  try {
    globalThis.fetch = async (_input, init) => ({ ok: true, async text() {
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    } });
    await assert.rejects(claimRpcFetch('https://rpc.test'), error => error.code === 'RPC_TIMEOUT' && error.status === 503);
  } finally { clearInterval(keepAlive); globalThis.fetch = original; }
});

test("fully sponsored claims never ask the creator to fund their wallet", () => {
  assert.equal(claimErrorMessage({ code: "INSUFFICIENT_FUNDS" }, "send", false, "0.92", true, true), "Registration is temporarily unavailable. Please try again shortly.");
});
