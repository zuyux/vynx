import test from 'node:test';
import assert from 'node:assert/strict';
import { walletOnboardingDestination } from '../lib/wallet-onboarding.ts';

test('Wallet onboarding requires a matching verified session and an explicitly missing alias', async () => {
  const originalFetch = globalThis.fetch;
  let body = { wallet: 'current-wallet', alias: null }, status = 200;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/session'); assert.equal(options.cache, 'no-store');
    options.signal?.throwIfAborted();
    return Response.json(body, { status });
  };
  try {
    assert.equal(await walletOnboardingDestination('current-wallet'), '/profile/buy-alias?welcome=1&next=%2Fdashboard%2Fcard');
    body.alias = 'existing_creator';
    assert.equal(await walletOnboardingDestination('current-wallet'), null);
    body = { wallet: 'other-wallet', alias: null };
    await assert.rejects(walletOnboardingDestination('current-wallet'), /sign-in changed/);
    body = { wallet: 'current-wallet' };
    await assert.rejects(walletOnboardingDestination('current-wallet'), /Unable to check/);
    status = 503; body = { error: 'Database unavailable' };
    await assert.rejects(walletOnboardingDestination('current-wallet'));
    status = 200; body = { wallet: 'current-wallet', alias: null };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(walletOnboardingDestination('current-wallet', controller.signal));
  } finally { globalThis.fetch = originalFetch; }
});
