// Deterministic RPC and Storage boundaries. Application validation/APIs and Postgres remain real.
import http from 'node:http';
import { Transaction, SystemInstruction, SystemProgram, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, decodeTransferCheckedInstruction } from '@solana/spl-token';

const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export async function fixtureServer(databaseUrl, registryOptions, storageKey) {
  const registry = registryOptions ? (await import('./registry-fixture.mjs')).registryFixture(registryOptions) : null;
  const objects = new Map();
  let failStorageDeletes = 0;
  const ledger = new Map();
  const koraSigner = Keypair.generate();
  const delays = new Map();
  let slot = 1;
  const server = http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-client-info');
    if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    try {
      if (request.url === '/kora') {
        const rpc = JSON.parse(raw);
        let result;
        if (rpc.method === 'getPayerSigner') result = { signer_address: koraSigner.publicKey.toBase58() };
        else if (rpc.method === 'signTransaction') {
          const transaction = Transaction.from(Buffer.from(rpc.params.transaction, 'base64'));
          if (!transaction.feePayer.equals(koraSigner.publicKey) || rpc.params.signer_key !== koraSigner.publicKey.toBase58()) throw new Error('Wrong sponsor.');
          transaction.partialSign(koraSigner);
          result = { signed_transaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'), signer_pubkey: koraSigner.publicKey.toBase58() };
        } else throw new Error('Unexpected Kora method.');
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result })); return;
      }
      if (request.url === '/test/storage') {
        failStorageDeletes = JSON.parse(raw).failDeletes ?? 0;
        response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}'); return;
      }
      if (request.url.startsWith('/storage/v1/object/')) {
        const prefix = '/storage/v1/object/';
        const key = decodeURIComponent(request.url.slice(prefix.length));
        if (request.method === 'GET' && key.startsWith('public/')) {
          const object = objects.get(key.slice('public/'.length));
          if (!object) { response.writeHead(404).end(); return; }
          response.writeHead(200, { 'Content-Type': object.type }).end(object.bytes); return;
        }
        if (request.headers.authorization !== `Bearer ${storageKey}`) { response.writeHead(403).end(); return; }
        if (request.method === 'POST') {
          if (objects.has(key)) { response.writeHead(409).end(); return; }
          objects.set(key, { bytes: raw, type: request.headers['content-type'] });
          response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ Key: key })); return;
        }
        if (request.method === 'DELETE') {
          if (failStorageDeletes > 0) { failStorageDeletes--; response.writeHead(503, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unavailable', statusCode: '503', message: 'Storage test outage' })); return; }
          const { prefixes } = JSON.parse(raw);
          for (const path of prefixes) objects.delete(`${key}/${path}`);
          response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(prefixes.map(name => ({ name })))); return;
        }
        response.writeHead(405).end(); return;
      }
      if (request.url.startsWith('/rest/v1')) {
        const target = `${databaseUrl}${request.url.slice('/rest/v1'.length)}`;
        const headers = { ...request.headers }; delete headers.host; delete headers['content-length'];
        const result = await fetch(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : raw });
        response.statusCode = result.status;
        for (const name of ['content-type', 'content-range', 'preference-applied', 'range-unit']) if (result.headers.has(name)) response.setHeader(name, result.headers.get(name));
        response.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (request.url === '/test/registry' && registry) {
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(registry.control(JSON.parse(raw)))); return;
      }
      if (request.url === '/test/submit') {
        const body = JSON.parse(raw);
        const tx = Transaction.from(Buffer.from(body.transaction, 'base64'));
        if (!tx.verifySignatures()) throw new Error('Test wallet submitted an unsigned transaction.');
        const signature = bs58.encode(tx.signature);
        if (registry && tx.instructions.some(ix => ix.programId.toBase58() === 'AxQxAgndT6ziUr3FBNafhJzF4PpniGpMX4fVRXXmh5y8')) {
          ledger.set(signature, registry.submit(tx)); delays.set(signature, body.delay ?? 0);
          response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ signature })); return;
        }
        const message = tx.compileMessage();
        const keys = message.accountKeys;
        const pre = keys.map(() => 1_000_000_000);
        const post = [...pre];
        const preTokenBalances = [];
        const postTokenBalances = [];
        const tokenOwners = new Map(tx.instructions.filter(ix => ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).map(ix => [ix.keys[1].pubkey.toBase58(), ix.keys[2].pubkey.toBase58()]));
        const instructions = tx.instructions.map(instruction => {
          if (instruction.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) return { program: 'spl-associated-token-account', programId: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(), parsed: { type: 'createIdempotent' } };
          if (instruction.programId.equals(TOKEN_PROGRAM_ID)) {
            const transfer = decodeTransferCheckedInstruction(instruction);
            const { source, destination, owner, mint } = transfer.keys;
            const amount = Number(transfer.data.amount);
            const index = keys.findIndex(key => key.equals(destination.pubkey));
            const balance = { accountIndex: index, mint: mint.pubkey.toBase58(), owner: tokenOwners.get(destination.pubkey.toBase58()), programId: TOKEN_PROGRAM_ID.toBase58() };
            preTokenBalances.push({ ...balance, uiTokenAmount: { amount: '0', decimals: 6, uiAmount: 0, uiAmountString: '0' } });
            postTokenBalances.push({ ...balance, uiTokenAmount: { amount: String(amount), decimals: 6, uiAmount: amount / 1e6, uiAmountString: String(amount / 1e6) } });
            return { program: 'spl-token', programId: TOKEN_PROGRAM_ID.toBase58(), parsed: { type: 'transferChecked', info: { source: source.pubkey.toBase58(), destination: destination.pubkey.toBase58(), authority: owner.pubkey.toBase58(), mint: mint.pubkey.toBase58(), tokenAmount: { amount: String(amount), decimals: 6 } } } };
          }
          if (instruction.programId.equals(SystemProgram.programId)) {
            const transfer = SystemInstruction.decodeTransfer(instruction);
            const from = keys.findIndex(key => key.equals(transfer.fromPubkey));
            const to = keys.findIndex(key => key.equals(transfer.toPubkey));
            post[from] -= Number(transfer.lamports); post[to] += Number(transfer.lamports);
            return { program: 'system', programId: SystemProgram.programId.toBase58(), parsed: { type: 'transfer', info: { source: transfer.fromPubkey.toBase58(), destination: transfer.toPubkey.toBase58(), lamports: Number(transfer.lamports) } } };
          }
          if (instruction.programId.toBase58() === MEMO) return { program: 'spl-memo', programId: MEMO, parsed: instruction.data.toString() };
          throw new Error('Unexpected instruction in test payment.');
        });
        delays.set(signature, body.delay ?? 0);
        ledger.set(signature, { slot: slot++, blockTime: Math.floor(Date.now() / 1000), version: 'legacy', meta: { err: body.failed ? { InstructionError: [0, 'Custom'] } : null, fee: 5000, preBalances: pre, postBalances: post, preTokenBalances, postTokenBalances, innerInstructions: [], logMessages: [] }, transaction: { signatures: tx.signatures.map(item => bs58.encode(item.signature)), message: { accountKeys: keys.map((key, index) => ({ pubkey: key.toBase58(), signer: message.isAccountSigner(index), writable: message.isAccountWritable(index), source: 'transaction' })), instructions, recentBlockhash: tx.recentBlockhash } } });
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ signature })); return;
      }
      const rpc = JSON.parse(raw);
      let result;
      const registryResult = registry?.rpc(rpc.method, rpc.params);
      if (registryResult !== undefined) {
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: registryResult })); return;
      }
      switch (rpc.method) {
        case 'getGenesisHash': result = GENESIS; break;
        case 'getLatestBlockhash': result = { context: { slot }, value: { blockhash: Keypair.generate().publicKey.toBase58(), lastValidBlockHeight: 100000 } }; break;
        case 'getTransaction': {
          const pending = delays.get(rpc.params[0]) ?? 0;
          if (pending > 0) delays.set(rpc.params[0], pending - 1);
          result = pending > 0 ? null : ledger.get(rpc.params[0]) ?? null; break;
        }
        case 'getSignatureStatuses': result = { context: { slot }, value: rpc.params[0].map(signature => ledger.has(signature) ? { slot, confirmations: null, err: ledger.get(signature).meta.err, confirmationStatus: 'finalized' } : null) }; break;
        case 'getBlockHeight': result = slot; break;
        default: throw new Error(`Unexpected RPC call: ${rpc.method}`);
      }
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
    } catch (reason) { response.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: reason.message })); }
  });
  return server;
}
