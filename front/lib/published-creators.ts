import { appDb } from './app-db';
import { normalizeAlias } from './alias';

export type PublishedCreatorListing = { username: string; display_name: string | null; bio: string | null; updated_at: string };

export async function publishedCreatorBatch(offset: number, limit: number) {
  const { data, error } = await appDb().from('cards_users')
    .select('username,display_name,bio,updated_at')
    .eq('published', true).order('username', { ascending: true }).range(offset, offset + limit - 1)
    .abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error('Published creator listing is unavailable.');
  const creators: PublishedCreatorListing[] = (data || []).filter(creator => {
    try { return normalizeAlias(creator.username) === creator.username; } catch { return false; }
  });
  return { creators, hasMore: data?.length === limit };
}

export async function publishedCreators(offset: number, limit: number): Promise<PublishedCreatorListing[]> {
  return (await publishedCreatorBatch(offset, limit)).creators;
}
