import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { readSession, SESSION_COOKIE } from '@/lib/wallet-session';
import { cache } from 'react';
import { publicCreator } from '@/lib/public-creator';
import { PublicCreatorCard } from '@/components/PublicCreatorCard';

export const dynamic = 'force-dynamic';
const getCreator = cache(async (alias: string) => {
  const wallet = await readSession((await cookies()).get(SESSION_COOKIE)?.value ?? '');
  return publicCreator(alias, wallet ?? '');
});
export async function generateMetadata({ params }: { params: Promise<{ alias: string }> }): Promise<Metadata> {
  const creator = await getCreator((await params).alias);
  if (!creator) return { title: 'Creator not found | VYNX' };
  if (creator.published === false) return { title: 'Your unpublished card | VYNX', robots: { index: false, follow: false } };
  const canonical = `${process.env.NEXT_PUBLIC_APP_URL}/${creator.alias}`;
  return { title: `${creator.design.name} (@${creator.alias}) | VYNX`, description: creator.design.bio || `Support ${creator.design.name} on VYNX.`, alternates: { canonical }, openGraph: { title: creator.design.name, description: creator.design.bio, url: canonical, images: [`${process.env.NEXT_PUBLIC_APP_URL}/logo.png`] } };
}
export default async function CreatorPage({ params }: { params: Promise<{ alias: string }> }) {
  const creator = await getCreator((await params).alias);
  if (!creator) notFound();
  return <PublicCreatorCard creator={creator} />;
}
