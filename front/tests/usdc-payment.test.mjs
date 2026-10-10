import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { tipCurrency, tipUsdcUnits, DEVNET_USDC_MINT, formatTipUnits } from '../lib/tip-currency.ts';
import { verifyUsdcPayment } from '../lib/usdc-payment.ts';
import { MEMO_PROGRAM } from '../lib/sol-payment.ts';
import { sponsorTipTransaction } from '../lib/kora.ts';

const payer = Keypair.generate().publicKey.toBase58();
const recipient = Keypair.generate().publicKey.toBase58();
const mint = new PublicKey(DEVNET_USDC_MINT);
const source = getAssociatedTokenAddressSync(mint, new PublicKey(payer));
const destination = getAssociatedTokenAddressSync(mint, new PublicKey(recipient));
const memo = 'vynx:tip:creator-id';
function payment() {
  const balance = { accountIndex: 2, mint: DEVNET_USDC_MINT, owner: recipient, uiTokenAmount: { amount: '1000000', decimals: 6 } };
  return { meta: { err: null, preTokenBalances: [], postTokenBalances: [balance] }, transaction: { message: {
    accountKeys: [{ pubkey: new PublicKey(payer), signer: true }, { pubkey: source, signer: false }, { pubkey: destination, signer: false }],
    instructions: [{ programId: TOKEN_PROGRAM_ID, parsed: { type: 'transferChecked', info: { source: source.toBase58(), destination: destination.toBase58(), authority: payer, mint: DEVNET_USDC_MINT, tokenAmount: { amount: '1000000', decimals: 6 } } } }, { programId: MEMO_PROGRAM, parsed: memo }],
  } } };
}
test('USDC uses exact six-decimal units, limits and independent currency totals', () => {
  assert.equal(tipUsdcUnits('0.01'), 10000);
  assert.equal(tipUsdcUnits('1.000001'), 1000001);
  assert.equal(tipUsdcUnits('1000'), 1000000000);
  for (const amount of ['0', '0.009999', '1000.000001', '1.0000001', '1e2', '-1', ' 1', 1, null]) assert.throws(() => tipUsdcUnits(amount));
  assert.equal(tipCurrency(undefined), 'SOL');
  assert.equal(tipCurrency('USDC'), 'USDC');
  assert.throws(() => tipCurrency('usdc'));
  assert.equal(formatTipUnits('1000001', 'USDC'), '1.000001');
  assert.equal(formatTipUnits('10000000', 'SOL'), '0.01');
});
test('USDC verification binds mint, signer, amount, recipient ATA, memo and balance increase', () => {
  assert.doesNotThrow(() => verifyUsdcPayment(payment(), payer, recipient, 1000000, memo));
  for (const mutate of [
    tx => { tx.meta.err = 'failed'; },
    tx => { tx.transaction.message.accountKeys[0].signer = false; },
    tx => { tx.transaction.message.instructions[0].programId = MEMO_PROGRAM; },
    tx => { tx.transaction.message.instructions[0].parsed.info.mint = payer; },
    tx => { tx.transaction.message.instructions[0].parsed.info.authority = recipient; },
    tx => { tx.transaction.message.instructions[0].parsed.info.source = recipient; },
    tx => { tx.transaction.message.instructions[0].parsed.info.destination = payer; },
    tx => { tx.transaction.message.instructions[0].parsed.info.tokenAmount.amount = '999999'; },
    tx => { tx.transaction.message.instructions[0].parsed.info.tokenAmount.decimals = 9; },
    tx => { tx.transaction.message.instructions[1].parsed = 'another-operation'; },
    tx => { tx.meta.postTokenBalances[0].owner = payer; },
    tx => { tx.meta.postTokenBalances[0].mint = payer; },
    tx => { tx.meta.postTokenBalances[0].uiTokenAmount.amount = '1'; },
    tx => { tx.meta.preTokenBalances = tx.meta.postTokenBalances; },
    tx => { tx.transaction.message.instructions.push(tx.transaction.message.instructions[0]); },
  ]) { const tx = payment(); mutate(tx); assert.throws(() => verifyUsdcPayment(tx, payer, recipient, 1000000, memo)); }
});
test('Kora sponsorship accepts only a valid fee-payer signature over the original message', async () => {
  const originalFetch = globalThis.fetch;
  const previousUrl = process.env.KORA_RPC_URL;
  const sponsor = Keypair.generate();
  const transaction = new Transaction({ feePayer: sponsor.publicKey, recentBlockhash: Keypair.generate().publicKey.toBase58() }).add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [], data: Buffer.from(memo) }));
  process.env.KORA_RPC_URL = 'http://localhost:8080';
  try {
    let mutate = false;
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.params.user_id, payer);
      assert.equal(request.params.signer_key, sponsor.publicKey.toBase58());
      const tx = Transaction.from(Buffer.from(request.params.transaction, 'base64'));
      if (mutate) tx.instructions[0].data = Buffer.from('changed');
      tx.partialSign(sponsor);
      return Response.json({ result: { signed_transaction: tx.serialize().toString('base64'), signer_pubkey: sponsor.publicKey.toBase58() } });
    };
    assert.ok(await sponsorTipTransaction(transaction, payer));
    mutate = true;
    await assert.rejects(() => sponsorTipTransaction(transaction, payer), /invalid transaction/);
    delete process.env.KORA_RPC_URL;
    await assert.rejects(() => sponsorTipTransaction(transaction, payer), /not available yet/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousUrl === undefined) delete process.env.KORA_RPC_URL; else process.env.KORA_RPC_URL = previousUrl;
  }
});
