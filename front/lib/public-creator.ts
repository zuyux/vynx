import { ApiError } from './wallet-session';
import { assertRegistryOwnership } from './alias-registration';
import { appDb } from '@/lib/app-db';
import { normalizeAlias } from '@/lib/alias';
import { draftFromProfile, type CreatorDraft } from '@/lib/creator-draft';

export type PublicCreator = { id: string; alias: string; wallet: string; tipsEnabled: boolean; design: CreatorDraft; published?: boolean };
export async function publicCreator(value: string, viewerWallet = ''): Promise<PublicCreator | null> {
  let alias;
  try { alias = normalizeAlias(value); } catch { return null; }
  let query = appDb().from('cards_users')
    .select('id,username,wallet_address,display_name,bio,avatar_url,banner_url,design,tips_enabled,published')
    .eq('username', alias);
  query = viewerWallet ? query.or(`published.eq.true,wallet_address.eq.${viewerWallet}`) : query.eq('published', true);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error('Creator storage is unavailable.');
  if (!data) return null;
  try { await assertRegistryOwnership(data.wallet_address, alias); }
  catch (reason) { if (reason instanceof ApiError && reason.code === 'REGISTRY_MIGRATION_REQUIRED') return null; throw reason; }
  const design = draftFromProfile({ alias, display_name: data.display_name || alias, bio: data.bio || '', design: data.design });
  return { id: data.id, alias, wallet: data.wallet_address, tipsEnabled: data.tips_enabled, published: data.published, design };
}
