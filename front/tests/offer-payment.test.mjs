import test from 'node:test';
import assert from 'node:assert/strict';
import { ComputeBudgetProgram, Keypair, Transaction } from '@solana/web3.js';
import { fixtureServer } from '../e2e/fixture-server.mjs';
import { buildOfferPayment, verifyOfferPayment } from '../lib/offer-payment.ts';
import { offerPriceUnits } from '../lib/offer-purchase.ts';

test('offer prices convert exactly to USDC units', () => {
  assert.equal(offerPriceUnits('25.000001'),25000001);
  assert.equal(offerPriceUnits('9999.999999'),9999999999);
  for (const price of ['0','-1','1e2','5 USDC','0.000001','10000','1.1234567']) assert.throws(()=>offerPriceUnits(price));
});
test('one-time payments verify the exact prepared offer, payer, creator, amount and signature', async () => {
  const server = await fixtureServer('http://127.0.0.1:1');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`, old = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL = `${url}/rpc`;
  const payer = Keypair.generate(), creator = Keypair.generate().publicKey.toBase58();
  const purchase = {id:'12345678-1234-1234-1234-123456789abc',price_units:25500000,transaction:null,last_valid_block_height:null,quoted_slot:null};
  try {
    const quote = await buildOfferPayment(purchase,payer.publicKey.toBase58(),creator);
    const prepared = {...purchase,transaction:quote.transaction,last_valid_block_height:quote.height,quoted_slot:quote.slot};
    const transaction = Transaction.from(Buffer.from(quote.transaction,'base64'));
    transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
    transaction.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({units:200000}), ComputeBudgetProgram.setComputeUnitPrice({microLamports:1000}));
    transaction.partialSign(payer);
    const submitted = await (await fetch(`${url}/test/submit`,{method:'POST',body:JSON.stringify({transaction:transaction.serialize().toString('base64')})})).json();
    await assert.doesNotReject(()=>verifyOfferPayment(prepared,payer.publicKey.toBase58(),creator,submitted.signature));
    for (const [changed,payingWallet,receivingWallet] of [
      [{...prepared,id:'22345678-1234-1234-1234-123456789abc'},payer.publicKey.toBase58(),creator],
      [{...prepared,price_units:1000000},payer.publicKey.toBase58(),creator],
      [prepared,Keypair.generate().publicKey.toBase58(),creator],
      [prepared,payer.publicKey.toBase58(),Keypair.generate().publicKey.toBase58()],
    ]) await assert.rejects(()=>verifyOfferPayment(changed,payingWallet,receivingWallet,submitted.signature),error=>error.code==='PAYMENT_MISMATCH');
    await assert.rejects(()=>buildOfferPayment(purchase,payer.publicKey.toBase58(),payer.publicKey.toBase58()),/own offer/);
  } finally {
    if (old===undefined) delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL; else process.env.NEXT_PUBLIC_SOLANA_RPC_URL=old;
    await new Promise(resolve=>server.close(resolve));
  }
});
