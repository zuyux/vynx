import test from 'node:test';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { Keypair, Transaction } from '@solana/web3.js';
import { GET, POST, OPTIONS } from '../app/api/actions/tip/[alias]/route.ts';
import { POST as confirm, OPTIONS as confirmOptions } from '../app/api/actions/tip/[alias]/confirm/route.ts';
import { GET as discovery, OPTIONS as discoveryOptions } from '../app/actions.json/route.ts';
import { ALIAS_BLOCKCHAIN_ID, DEVNET_GENESIS_HASH } from '../lib/alias-network.ts';
import { decodeTransferCheckedInstruction } from '@solana/spl-token';
import { buildTip } from '../lib/tip-server.ts';
import { MEMO_PROGRAM } from '../lib/sol-payment.ts';
const origin = 'https://vynx.example';
const payer = Keypair.generate().publicKey.toBase58();
const recipient = Keypair.generate().publicKey.toBase58();
const context = { params: Promise.resolve({ alias: 'Alice' }) };
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const request = (method, query = '', body) => new Request(`${origin}/api/actions/tip/Alice${query}`, { method, headers: { origin: 'https://blink.example', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test('public USDC Action builds sponsored tips and preserves legacy SOL verification', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SOLANA_RPC_URL', 'KORA_RPC_URL'];
  const saved = keys.map(key => process.env[key]);
  Object.assign(process.env, { SUPABASE_URL: 'https://tip-action.supabase.co', SUPABASE_SECRET_KEY: 'test-key', NEXT_PUBLIC_APP_URL: origin, NEXT_PUBLIC_SOLANA_RPC_URL: 'https://rpc.example', KORA_RPC_URL: 'https://kora.example' });
  let published = true, enabled = true, rpcCalls = 0, payment = null, record = null, storageFails = false;
  const signature = '1'.repeat(88);
  const sponsor = Keypair.generate();
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    if (url.pathname.endsWith('/rpc/consume_public_endpoint_limit')) return json({ allowed: true, retry_after: 60 });
    if (url.hostname === 'kora.example') {
      const rpc = await req.json();
      if (rpc.method === 'getPayerSigner') return json({ result: { signer_address: sponsor.publicKey.toBase58() } });
      const tx = Transaction.from(Buffer.from(rpc.params.transaction, 'base64'));
      tx.partialSign(sponsor);
      return json({ result: { signed_transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), signer_pubkey: sponsor.publicKey.toBase58() } });
    }
    if (url.hostname === 'rpc.example') {
      rpcCalls++;
      const rpc = await req.json();
      const result = rpc.method === 'getGenesisHash' ? DEVNET_GENESIS_HASH : rpc.method === 'getLatestBlockhash' ? { context: { slot: 1 }, value: { blockhash: payer, lastValidBlockHeight: 150 } } : rpc.method === 'getTransaction' ? payment : undefined;
      assert.notEqual(result, undefined);
      return json({ jsonrpc: '2.0', id: rpc.id, result });
    }
    if (url.pathname.endsWith('/cards_users')) {
      if (storageFails) return new Response(JSON.stringify({ message: 'private database detail' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (url.searchParams.get('published') === 'eq.true' && !published) return json([]);
      return json([{ id: 'creator-id', username: 'alice', wallet_address: recipient, display_name: 'Alice', published, tips_enabled: enabled }]);
    }
    if (url.pathname.endsWith('/tips')) {
      if (req.method === 'POST') { record = await req.json(); return json(null); }
      return json(record ? [record] : []);
    }
    throw Error(`Unexpected request ${url.pathname}`);
  };
  // web3.js captures fetch at import time; serve its RPC over a real local socket.
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const response = await globalThis.fetch('https://rpc.example', { method: 'POST', body: raw });
    res.setHeader('Content-Type', 'application/json');
    res.end(await response.text());
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const response of [await OPTIONS(), await confirmOptions(), await discoveryOptions(), await discovery()]) {
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
      assert.equal(response.headers.get('X-Blockchain-Ids'), ALIAS_BLOCKCHAIN_ID);
      assert.match(response.headers.get('Access-Control-Allow-Headers'), /Authorization/);
    }
    const rules = (await (await discovery()).json()).rules;
    assert.ok(rules.some(rule => rule.pathPattern === '/*' && rule.apiPath === '/api/actions/tip/*'));
    assert.ok(rules.some(rule => rule.pathPattern === '/creators/*'));
    const metadata = await (await GET(request('GET'), context)).json();
    assert.equal(metadata.type, 'action'); assert.equal(metadata.disabled, false);
    assert.equal(metadata.icon, `${origin}/android-chrome-512x512.png`);
    assert.equal(metadata.links.actions.length, 4);
    assert.equal(metadata.links.actions[3].href, '/api/actions/tip/alice?amount={amount}');
    published = false;
    assert.equal((await GET(request('GET'), context)).status, 404);
    assert.equal((await POST(request('POST', '', { account: payer }), context)).status, 404);
    published = true; enabled = false;
    assert.equal((await (await GET(request('GET'), context)).json()).disabled, true);
    assert.equal((await POST(request('POST', '', { account: payer }), context)).status, 404);
    enabled = true;
    for (const query of ['?amount=0', '?amount=1001', '?amount=1e-2', '?amount=0.0000000001', '?currency=SOL']) assert.equal((await POST(request('POST', query, { account: payer }), context)).status, 400);
    for (const body of [null, {}, { account: 'invalid' }, { account: recipient }]) assert.equal((await POST(request('POST', '', body), context)).status, 400);
    assert.equal(rpcCalls, 0);
    const built = await POST(request('POST', '?amount=1.000001', { account: payer, recipient: payer }), context);
    assert.equal(built.status, 200);
    const body = await built.json();
    const tx = Transaction.from(Buffer.from(body.transaction, 'base64'));
    assert.equal(tx.feePayer.toBase58(), sponsor.publicKey.toBase58()); assert.equal(tx.instructions.length, 3);
    const transfer = decodeTransferCheckedInstruction(tx.instructions[1]);
    assert.equal(transfer.data.amount, 1000001n);
    assert.equal(tx.instructions[2].data.toString(), 'vynx:tip:creator-id');
    assert.equal(body.links.next.href, '/api/actions/tip/alice/confirm?currency=USDC&amount=1.000001');
    assert.match(body.message, /USDC/);
    await assert.rejects(buildTip('alice', payer, '1', 'SOL'), /only accepted in USDC/);
    const defaultTip = await buildTip('alice', payer, '1');
    assert.equal(defaultTip.currency, 'USDC');
    assert.equal(defaultTip.sponsored, true);
    assert.equal(record, null);
    const callback = () => request('POST', '?amount=0.01', { account: payer, signature });
    assert.equal((await confirm(callback(), context)).status, 409);
    payment = { slot: 1, blockTime: null, version: 'legacy', meta: { err: null, fee: 5000, preBalances: [100000000, 0], postBalances: [89995000, 10000000], innerInstructions: [], logMessages: [], preTokenBalances: [], postTokenBalances: [] }, transaction: { signatures: [signature], message: { recentBlockhash: payer,
      accountKeys: [{ pubkey: payer, signer: true, writable: true }, { pubkey: recipient, signer: false, writable: true }], instructions: [
        { program: 'system', programId: '11111111111111111111111111111111', parsed: { type: 'transfer', info: { source: payer, destination: recipient, lamports: 10000000 } } },
        { program: 'spl-memo', programId: MEMO_PROGRAM.toBase58(), parsed: 'vynx:tip:wrong-creator' },
      ],
    } } };
    assert.equal((await confirm(callback(), context)).status, 400); assert.equal(record, null);
    payment.transaction.message.instructions[1].parsed = 'vynx:tip:creator-id';
    const response = await confirm(callback(), context);
    assert.equal(response.status, 200); assert.equal((await response.json()).type, 'completed');
    assert.equal(record.payer, payer); assert.equal(record.recipient, recipient); assert.equal(record.lamports, 10000000); assert.equal(record.currency, 'SOL');
    assert.equal((await confirm(callback(), context)).status, 200);
    const wrongAmount = await confirm(request('POST', '?amount=0.02', { account: payer, signature }), context);
    assert.equal(wrongAmount.status, 409); assert.equal(wrongAmount.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(typeof (await wrongAmount.json()).message, 'string');
    storageFails = true;
    const failure = await GET(request('GET'), context);
    assert.equal(failure.status, 500);
    assert.equal(failure.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(failure.headers.get('Cache-Control'), 'no-store');
    assert.equal((await failure.json()).message, 'Something went wrong. Please try again shortly.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; });
  }
});
