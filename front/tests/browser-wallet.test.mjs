import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateBrowserWallet, browserWallet, restoreBrowserWallet } from '../lib/browser-wallet.ts';

const key = address => ({ toBase58: () => address });
test('Phantom and Brave choices resolve their exact providers without falling back to window.solana', () => {
  const phantom = { isPhantom: true }, brave = { isPhantom: true };
  const source = { phantom: { solana: phantom }, braveSolana: brave, solana: brave };
  assert.equal(browserWallet('phantom', source), phantom);
  assert.equal(browserWallet('brave', source), brave);
  assert.throws(() => browserWallet('phantom', { braveSolana: brave, solana: brave }), /Phantom is unavailable/);
  assert.throws(() => browserWallet('brave', { phantom: { solana: phantom } }), /Brave Wallet is unavailable/);
});
test('cached public keys still require connect and a freshly verified sign-in before returning a wallet', async () => {
  const oldFetch = globalThis.fetch, calls = [];
  let responseStatus = 200;
  const provider = { publicKey: key('wallet'), isConnected: true,
    connect: async () => { calls.push('connect'); return { publicKey: key('wallet') }; },
    signMessage: async () => { calls.push('sign'); return { publicKey: key('wallet'), signature: Uint8Array.of(1, 2) }; } };
  globalThis.fetch = async (url, init) => {
    calls.push(url); assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    if (url === '/api/auth/nonce') { assert.equal(body.wallet, 'wallet'); return Response.json({ id: 'fresh-nonce', message: 'Fresh sign-in challenge' }); }
    assert.deepEqual(body, { wallet: 'wallet', id: 'fresh-nonce', signature: '0102' });
    return Response.json(responseStatus === 200 ? { wallet: 'wallet' } : { error: 'Sign-in rejected' }, { status: responseStatus });
  };
  try {
    assert.equal(await authenticateBrowserWallet(provider), 'wallet');
    assert.deepEqual(calls, ['connect', '/api/auth/nonce', 'sign', '/api/auth/session']);
    calls.length = 0; responseStatus = 401;
    await assert.rejects(authenticateBrowserWallet(provider), /Sign-in rejected/);
    assert.equal(calls[0], 'connect');
    calls.length = 0;
    provider.signMessage = async () => { calls.push('sign'); return { publicKey: key('other-wallet'), signature: Uint8Array.of(1) }; };
    await assert.rejects(authenticateBrowserWallet(provider), /Wallet changed/);
    assert.ok(!calls.includes('/api/auth/session'));
    calls.length = 0;
    const controller = new AbortController(); controller.abort();
    await assert.rejects(authenticateBrowserWallet(provider, controller.signal));
    assert.deepEqual(calls, ['connect']);
  } finally { globalThis.fetch = oldFetch; }
});

test('restoring signing access requires one live provider matching the verified session', () => {
  const phantom = { publicKey: key('payer'), isConnected: true };
  const brave = { publicKey: key('other'), isConnected: true };
  const source = { phantom: { solana: phantom }, braveSolana: brave };
  assert.deepEqual(restoreBrowserWallet('payer', source), { method: 'phantom', provider: phantom, address: 'payer' });
  assert.deepEqual(restoreBrowserWallet('other', source), { method: 'brave', provider: brave, address: 'other' });
  assert.equal(restoreBrowserWallet('', source), null);
  assert.equal(restoreBrowserWallet('unknown', source), null);
  phantom.isConnected = false;
  assert.equal(restoreBrowserWallet('payer', source), null);
  delete phantom.isConnected;
  assert.equal(restoreBrowserWallet('payer', source), null);
  phantom.isConnected = true;
  brave.publicKey = key('payer');
  assert.equal(restoreBrowserWallet('payer', source), null);
});
