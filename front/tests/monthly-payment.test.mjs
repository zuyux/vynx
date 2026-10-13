import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, Transaction } from '@solana/web3.js';
import { fixtureServer } from '../e2e/fixture-server.mjs';
import { buildMonthlyPayment, verifyMonthlyPayment, recoverExpiredMonthlyPayment } from '../lib/monthly-payment.ts';

test('monthly wallet payments bind the invoice, payer, recipient and exact USDC; recovery finds the original transfer', async () => {
  const server = await fixtureServer('http://127.0.0.1:1');
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`, old = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL = `${url}/rpc`;
  const payer = Keypair.generate(), creator = Keypair.generate().publicKey.toBase58();
  const invoice = { id: '12345678-1234-1234-1234-123456789abc',price_units:40000000,transaction:null,last_valid_block_height:null,quoted_slot:null };
  try {
    const quote = await buildMonthlyPayment(invoice,payer.publicKey.toBase58(),creator);
    const prepared = { ...invoice,transaction:quote.transaction,last_valid_block_height:quote.height,quoted_slot:quote.slot };
    const tx = Transaction.from(Buffer.from(quote.transaction,'base64'));
    tx.partialSign(payer);
    const submitted = await (await fetch(`${url}/test/submit`,{method:'POST',body:JSON.stringify({transaction:tx.serialize().toString('base64')})})).json();
    await assert.doesNotReject(() => verifyMonthlyPayment(prepared,payer.publicKey.toBase58(),creator,submitted.signature));
    for (const [changedInvoice,changedPayer,changedCreator] of [
      [{...prepared,id:'22345678-1234-1234-1234-123456789abc'},payer.publicKey.toBase58(),creator],
      [{...prepared,price_units:1000000},payer.publicKey.toBase58(),creator],
      [prepared,Keypair.generate().publicKey.toBase58(),creator],
      [prepared,payer.publicKey.toBase58(),Keypair.generate().publicKey.toBase58()],
    ]) await assert.rejects(() => verifyMonthlyPayment(changedInvoice,changedPayer,changedCreator,submitted.signature),error => error.code==='PAYMENT_MISMATCH');
    await assert.rejects(() => recoverExpiredMonthlyPayment(prepared,payer.publicKey.toBase58()),error => error.code==='PAYMENT_PENDING');
    const recovered = await recoverExpiredMonthlyPayment({...prepared,last_valid_block_height:0},payer.publicKey.toBase58());
    assert.equal(recovered.signature,submitted.signature);
    const unpaid = await buildMonthlyPayment({...invoice,id:'32345678-1234-1234-1234-123456789abc'},payer.publicKey.toBase58(),creator);
    const empty = await recoverExpiredMonthlyPayment({...invoice,transaction:unpaid.transaction,last_valid_block_height:0,quoted_slot:unpaid.slot},payer.publicKey.toBase58());
    assert.equal(empty.signature,null);
    await assert.rejects(() => buildMonthlyPayment(invoice,payer.publicKey.toBase58(),payer.publicKey.toBase58()),/own monthly offer/);
  } finally { if (old===undefined) delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL; else process.env.NEXT_PUBLIC_SOLANA_RPC_URL=old; await new Promise(resolve=>server.close(resolve)); }
});
