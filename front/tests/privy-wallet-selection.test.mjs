import test from 'node:test';
import assert from 'node:assert/strict';
import { canRestorePrivyEmbeddedSession, selectPrivySolanaWallet } from '../lib/privy-wallet-selection.ts';

test('Google sign-in selects its linked embedded Solana wallet over an unrelated connected wallet', () => {
  const external = { address: 'unrelated-phantom' }, embedded = { address: 'google-embedded' };
  const accounts = [
    { type: 'google_oauth' },
    { type: 'wallet', chainType: 'solana', walletClientType: 'privy', address: embedded.address },
  ];
  assert.equal(selectPrivySolanaWallet([external, embedded], accounts), embedded);
  assert.equal(selectPrivySolanaWallet([external], accounts), undefined);
  assert.equal(selectPrivySolanaWallet([external], []), undefined);
});

test('selection honors a linked primary Solana wallet and excludes other chains and stale accounts', () => {
  const external = { address: 'linked-phantom' }, embedded = { address: 'embedded' };
  const accounts = [
    { type: 'wallet', chainType: 'solana', address: external.address },
    { type: 'wallet', chainType: 'solana', walletClientType: 'privy', address: embedded.address },
  ];
  assert.equal(selectPrivySolanaWallet([external, embedded], accounts, external.address), external);
  assert.equal(selectPrivySolanaWallet([external, embedded], accounts, 'old-account'), embedded);
  assert.equal(selectPrivySolanaWallet([external], [{ type: 'wallet', chainType: 'ethereum', address: external.address }]), undefined);
});

test('email wallet restoration requires a matching verified session and never restores an external wallet', () => {
  assert.equal(canRestorePrivyEmbeddedSession('email-wallet', 'Privy', 'email-wallet'), true);
  for (const session of [null, undefined, '', 'other-wallet']) {
    assert.equal(canRestorePrivyEmbeddedSession('email-wallet', 'Privy', session), false);
  }
  assert.equal(canRestorePrivyEmbeddedSession('email-wallet', 'Phantom', 'email-wallet'), false);
  assert.equal(canRestorePrivyEmbeddedSession('', 'Privy', ''), false);
});
