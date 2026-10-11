import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaimedAlias } from '../lib/claimed-alias.ts';

function database(owned, claimed, error = null) {
  return { from(table) {
    assert.equal(table, 'cards_users');
    return { select() { return { eq(column, value) {
      assert.equal(value, column === 'wallet_address' ? 'current-wallet' : 'alice');
      return { maybeSingle: async () => ({ data: column === 'wallet_address' ? owned : claimed, error }) };
    } }; } };
  } };
}

test('purchased alias is accepted only for its wallet', async () => {
  await validateClaimedAlias(database({username:'alice'}, {wallet_address:'current-wallet'}), 'current-wallet', 'alice');
  await assert.rejects(validateClaimedAlias(database({username:'other'}, null), 'current-wallet', 'alice'), /@other/);
  await assert.rejects(validateClaimedAlias(database(null, {wallet_address:'different-wallet'}), 'current-wallet', 'alice'), /another wallet/);
});

test('unclaimed aliases remain available and failed lookups block writes', async () => {
  await validateClaimedAlias(database(null, null), 'current-wallet', 'alice');
  await assert.rejects(validateClaimedAlias(database(null, null, {message:'Unavailable'}), 'current-wallet', 'alice'), /verify/);
});
