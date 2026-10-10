import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/lib/wallet-session';
import { cache } from 'react';
import { publicCreator } from '@/lib/public-creator';
import { PublicCreatorCard } from '@/components/PublicCreatorCard';
import { createHash } from 'node:crypto';
import { creatorStructuredData, jsonLd, PRIVATE_METADATA, siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';
const getCreator = cache(async (alias: string) => {
  const wallet = await readSession((await cookies()).get(SESSION_COOKIE)?.value ?? '');
  return publicCreator(alias, wallet ?? '');
});
export async function generateMetadata({ params }: { params: Promise<{ alias: string }> }): Promise<Metadata> {
  const creator = await getCreator((await params).alias);
  if (!creator) return { title: 'Creator not found', ...PRIVATE_METADATA };
  if (creator.published === false) return { title: 'Your unpublished card', ...PRIVATE_METADATA };
  const canonical = siteUrl(`/${creator.alias}`);
  const version = createHash('sha256').update(JSON.stringify(creator.design)).digest('hex').slice(0, 16);
  const image = { url: siteUrl(`/${creator.alias}/og?v=${version}`), width: 1200, height: 630, alt: `${creator.design.name} (@${creator.alias}) creator card` };
  const title = `${creator.design.name} (@${creator.alias}) | VYNX`;
  const description = creator.design.bio || `Support ${creator.design.name} on VYNX.`;
  return { title: { absolute: title }, description, alternates: { canonical },
    openGraph: { type: 'website', siteName: 'VYNX', title, description, url: canonical, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] } };
}
export default async function CreatorPage({ params }: { params: Promise<{ alias: string }> }) {
  const creator = await getCreator((await params).alias);
  if (!creator) notFound();
  return <>
    {creator.published !== false && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(creatorStructuredData(creator)) }} />}
    <PublicCreatorCard creator={creator} />
  </>;
}
