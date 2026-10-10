import type { MetadataRoute } from 'next';
import { publishedCreatorBatch } from '@/lib/published-creators';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [{ url: siteUrl(), changeFrequency: 'weekly', priority: 1 }];
  // Supabase returns at most 1,000 rows by default. Page through the full list.
  for (let offset = 0; ; offset += 1000) {
    const { creators, hasMore } = await publishedCreatorBatch(offset, 1000);
    for (const creator of creators) {
      entries.push({ url: siteUrl(`/${creator.username}`), lastModified: creator.updated_at,
        changeFrequency: 'weekly', priority: 0.7 });
    }
    if (entries.length > 50000) throw new Error('Split creator sitemaps before exceeding 50,000 URLs.');
    if (!hasMore) break;
  }
  return entries;
}
