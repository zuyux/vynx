import { assertRegistryOwnership } from './alias-registration';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function validateClaimedAlias(db: SupabaseClient, wallet: string, alias: string) {
  await assertRegistryOwnership(wallet, alias);
  const results = await Promise.all([
    db.from('cards_users').select('username').eq('wallet_address', wallet).maybeSingle(),
    db.from('cards_users').select('wallet_address').eq('username', alias).maybeSingle(),
  ]);
  if (results.some(result => result.error)) throw new Error("Could not verify the purchased alias. Try again.");
  const owned = results[0].data;
  const claimed = results[1].data;
  if (owned && owned.username !== alias) throw new Error(`Use the alias purchased by your wallet: @${owned.username}.`);
  if (claimed && claimed.wallet_address !== wallet) throw new Error('That alias belongs to another wallet.');
}
